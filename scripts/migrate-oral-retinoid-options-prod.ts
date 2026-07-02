// scripts/migrate-oral-retinoid-options-prod.ts
// Приводит опции активной анкеты к новой формулировке для oral_medications и
// retinoid_reaction (см. seed-questionnaire-v2.ts + PR risk-signals):
//   - oral_medications: «Гормональные (Спиронолактон, ОК)» → разделяем на
//     «Спиронолактон / антиандрогенная терапия», «Оральные контрацептивы…»,
//     «Тиреоидные препараты (L-тироксин, Эутирокс…)». Спиронолактон ≠ гормональный.
//   - retinoid_reaction: добавляем «Сильная реакция была на конкретное средство,
//     другие ретиноиды переносились нормально» (нюанс из ОС).
//
// БЕЗОПАСНОСТЬ: миграция АДДИТИВНАЯ и идемпотентная — НЕ переназначает значения
// существующих опций (answerValues в user_answers хранят строки-values, переиспользование
// индекса изменило бы смысл исторических ответов). Поэтому «Нет, не принимаю» остаётся
// value=oral_medications_4 (только меняем position), а новые опции получают новые values.
// Downstream-логика матчит по ЛЕЙБЛАМ, поэтому расхождение схемы values с фрешсидом не влияет.
//
// Запуск:  DATABASE_URL=... tsx scripts/migrate-oral-retinoid-options-prod.ts --dry-run
//          DATABASE_URL=... tsx scripts/migrate-oral-retinoid-options-prod.ts

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();
const dryRun = process.argv.includes('--dry-run');

// Желаемое состояние опций: ключ — value (стабильный идентификатор), значение — {label, position}.
// Существующие values сохраняем; новые добавляем с новыми values.
const DESIRED: Record<string, Array<{ value: string; label: string; position: number }>> = {
  oral_medications: [
    { value: 'oral_medications_1', label: 'Изотретиноин (Аккутан, Роаккутан и аналоги)', position: 1 },
    { value: 'oral_medications_2', label: 'Антибиотики (Доксициклин, Миноциклин, Эритромицин и др.)', position: 2 },
    { value: 'oral_medications_3', label: 'Спиронолактон / антиандрогенная терапия', position: 3 },
    { value: 'oral_medications_5', label: 'Оральные контрацептивы или другая гормональная терапия', position: 4 },
    { value: 'oral_medications_6', label: 'Тиреоидные препараты (L-тироксин, Эутирокс и аналоги)', position: 5 },
    { value: 'oral_medications_4', label: 'Нет, не принимаю', position: 6 },
  ],
  retinoid_reaction: [
    { value: 'retinoid_reaction_1', label: 'Без реакции, кожа спокойно перенесла', position: 1 },
    { value: 'retinoid_reaction_2', label: 'Лёгкое шелушение или сухость — прошли быстро', position: 2 },
    { value: 'retinoid_reaction_5', label: 'Сильная реакция была на конкретное средство, другие ретиноиды переносились нормально', position: 3 },
    { value: 'retinoid_reaction_3', label: 'Сильное раздражение, жжение, краснота', position: 4 },
    { value: 'retinoid_reaction_4', label: 'Никогда не использовал(а)', position: 5 },
  ],
};

async function main() {
  const questionnaire = await prisma.questionnaire.findFirst({ where: { isActive: true } });
  if (!questionnaire) {
    console.log('❌ Активная анкета не найдена');
    return;
  }
  console.log(`Активная анкета: id=${questionnaire.id} «${questionnaire.name}»${dryRun ? ' [DRY-RUN]' : ''}\n`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [code, desiredOptions] of Object.entries(DESIRED)) {
    const question = await prisma.question.findFirst({
      where: { questionnaireId: questionnaire.id, code },
      include: { answerOptions: true },
    });
    if (!question) {
      console.log(`⚠️  Вопрос code=${code} не найден в активной анкете — пропуск`);
      continue;
    }

    const byValue = new Map(question.answerOptions.map((o) => [o.value, o]));
    console.log(`[${code}] текущих опций: ${question.answerOptions.length}`);

    for (const desired of desiredOptions) {
      const existing = byValue.get(desired.value);
      if (!existing) {
        console.log(`  + CREATE ${desired.value} pos=${desired.position} «${desired.label}»`);
        if (!dryRun) {
          await prisma.answerOption.create({
            data: { questionId: question.id, value: desired.value, label: desired.label, position: desired.position },
          });
        }
        created += 1;
      } else if (existing.label !== desired.label || existing.position !== desired.position) {
        const labelChange = existing.label !== desired.label ? ` label «${existing.label}»→«${desired.label}»` : '';
        const posChange = existing.position !== desired.position ? ` pos ${existing.position}→${desired.position}` : '';
        console.log(`  ~ UPDATE ${desired.value}${labelChange}${posChange}`);
        if (!dryRun) {
          await prisma.answerOption.update({
            where: { id: existing.id },
            data: { label: desired.label, position: desired.position },
          });
        }
        updated += 1;
      } else {
        unchanged += 1;
      }
    }
  }

  console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}✅ created=${created}, updated=${updated}, unchanged=${unchanged}`);
  if (!dryRun) console.log('⚠️  Старые опции с другими values НЕ удалялись (исторические ответы сохраняют смысл).');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
