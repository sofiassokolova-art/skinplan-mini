// scripts/add-postacne-concern-option.ts
// Добавляет опцию «Следы от акне (постакне)» в вопрос skin_concerns активной анкеты.
//
// Зачем: правило postacne-scars (priority 96) матчит concerns hasSome
// ['postacne_scars'], но ни одна опция анкеты не давала такого сигнала → правило
// было недостижимо. Опция + маппинг лейбла→токен (lib/recommendations-generator.ts:
// concernLabelsToRuleTokens) делают его рабочим. value опции не важен для матчинга
// (resolve идёт по label), используем стабильный 'skin_concerns_postacne'.
//
// Идемпотентно (повторный запуск не дублирует). DRY=1 — превью без записи.
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';

const LABEL = 'Следы от акне (постакне)';
const VALUE = 'skin_concerns_postacne';
const SCORE = { pigmentation: 1, concerns: ['postacne_scars'] };

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'}\n`);

  const questionnaire = await prisma.questionnaire.findFirst({ where: { isActive: true } });
  if (!questionnaire) {
    console.error('⛔ Активная анкета не найдена');
    return;
  }
  const question = await prisma.question.findFirst({
    where: { questionnaireId: questionnaire.id, code: 'skin_concerns' },
    include: { answerOptions: true },
  });
  if (!question) {
    console.error('⛔ Вопрос skin_concerns не найден в активной анкете');
    return;
  }

  const exists = question.answerOptions.some(
    (o) => o.value === VALUE || /остакне|следы от акне/i.test(o.label)
  );
  if (exists) {
    console.log(`✓ Опция «${LABEL}» уже есть (вопрос #${question.id}) — пропуск`);
    return;
  }

  const position = Math.max(0, ...question.answerOptions.map((o) => o.position)) + 1;
  console.log(`CREATE option в вопросе #${question.id} (анкета v${questionnaire.version})`);
  console.log(`   label: ${LABEL}`);
  console.log(`   value: ${VALUE}`);
  console.log(`   position: ${position}`);
  console.log(`   scoreJson: ${JSON.stringify(SCORE)}`);
  if (DRY) {
    console.log('\n(dry-run, изменений нет)');
    return;
  }
  await prisma.answerOption.create({
    data: {
      questionId: question.id,
      value: VALUE,
      label: LABEL,
      position,
      scoreJson: SCORE as any,
    },
  });
  console.log('   ✅ создано');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
