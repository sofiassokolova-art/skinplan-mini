// scripts/update-quiz-multichoice.ts
// Применяет к ЖИВОЙ анкете (questionnaire 18) изменения по обратной связи:
//  - seasonal_changes: single_choice → multi_choice (летом жирнее + зимой суше — не взаимоисключающие)
//  - allergies: single_choice → multi_choice (аллергия может быть на разное)
//  - oral_medications: вопрос → настоящее время («сейчас»), опция «Нет, не принимал(а)» → «Нет, не принимаю»
// Идемпотентно: повторный запуск просто выставит те же значения.
// Запуск: DATABASE_URL=... tsx scripts/update-quiz-multichoice.ts

import { prisma } from '../lib/db';

const QUESTIONNAIRE_ID = 18;

async function main() {
  const targets = [
    {
      code: 'seasonal_changes',
      type: 'multi_choice',
      text: 'Меняется ли состояние кожи в зависимости от сезона? (можно выбрать несколько)',
    },
    {
      code: 'allergies',
      type: 'multi_choice',
      text: 'Отмечались ли у вас аллергические реакции на косметические или уходовые средства? (можно выбрать несколько)',
    },
    {
      code: 'oral_medications',
      type: 'multi_choice',
      text: 'Принимаете ли вы сейчас пероральные препараты?',
    },
  ];

  for (const t of targets) {
    const q = await prisma.question.findFirst({
      where: { questionnaireId: QUESTIONNAIRE_ID, code: t.code },
      select: { id: true, type: true, text: true },
    });
    if (!q) {
      console.log(`⚠️  ${t.code}: не найден в анкете ${QUESTIONNAIRE_ID}`);
      continue;
    }
    await prisma.question.update({
      where: { id: q.id },
      data: { type: t.type, text: t.text },
    });
    console.log(`✅ ${t.code} (id=${q.id}): type=${t.type}, text обновлён`);
  }

  // Опция пероральных: прошедшее → настоящее время.
  const oral = await prisma.question.findFirst({
    where: { questionnaireId: QUESTIONNAIRE_ID, code: 'oral_medications' },
    select: { id: true },
  });
  if (oral) {
    const res = await prisma.answerOption.updateMany({
      where: { questionId: oral.id, label: 'Нет, не принимал(а)' },
      data: { label: 'Нет, не принимаю' },
    });
    console.log(`✅ oral_medications опция «Нет»: обновлено ${res.count}`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
