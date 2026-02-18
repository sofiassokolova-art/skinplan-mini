// scripts/update-skin-goals-options.ts
// Обновление формулировок вариантов ответов для вопроса skin_goals

import { prisma } from '../lib/db';

const OLD_TO_NEW_LABELS: Record<string, string> = {
  'Морщины и мелкие линии': 'Сократить морщины и мелкие линии',
  'Акне и высыпания': 'Избавиться от акне и высыпаний',
  'Сократить видимость пор': 'Сделать поры менее заметными',
  'Уменьшить отёчность': 'Уменьшить отёчность лица',
  'Выровнять пигментацию': 'Выровнять тон и пигментацию',
  'Улучшить текстуру кожи': 'Улучшить текстуру и гладкость кожи',
};

async function updateSkinGoalsOptions() {
  console.log('🔄 Обновляю формулировки вариантов ответов для skin_goals...');

  try {
    // Находим вопрос skin_goals
    const question = await prisma.question.findFirst({
      where: { code: 'skin_goals' },
      include: { answerOptions: true },
    });

    if (!question) {
      console.log('❌ Вопрос skin_goals не найден');
      return;
    }

    console.log(`✅ Найден вопрос: ${question.text} (ID: ${question.id})`);
    console.log(`   Вариантов ответов: ${question.answerOptions.length}`);

    // Также обновляем текст вопроса
    await prisma.question.update({
      where: { id: question.id },
      data: { text: 'Выберите ваши главные цели' },
    });
    console.log('✅ Текст вопроса обновлён на "Выберите ваши главные цели"');

    // Обновляем каждый вариант ответа
    for (const option of question.answerOptions) {
      const newLabel = OLD_TO_NEW_LABELS[option.label];
      
      if (newLabel) {
        await prisma.answerOption.update({
          where: { id: option.id },
          data: { label: newLabel },
        });
        console.log(`   ✅ "${option.label}" → "${newLabel}"`);
      } else {
        console.log(`   ⚠️ Пропущен: "${option.label}" (нет соответствия)`);
      }
    }

    console.log('\n✅ Обновление завершено!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSkinGoalsOptions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
