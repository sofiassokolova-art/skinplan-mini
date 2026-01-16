// scripts/update-skin-sensitivity-question.ts
// Скрипт для обновления текста вопроса skin_sensitivity и его вариантов ответов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSkinSensitivityQuestion() {
  console.log('🔄 Обновляю текст вопроса skin_sensitivity и варианты ответов...');

  try {
    // Находим вопрос skin_sensitivity
    const question = await prisma.question.findFirst({
      where: { code: 'skin_sensitivity' },
      include: { answerOptions: { orderBy: { position: 'asc' } } },
    });

    if (!question) {
      console.log('❌ Вопрос skin_sensitivity не найден');
      return;
    }

    console.log(`✅ Найден вопрос: ${question.text} (ID: ${question.id})`);
    console.log(`   Вариантов ответов: ${question.answerOptions.length}`);

    // Обновляем текст вопроса
    await prisma.question.update({
      where: { id: question.id },
      data: { text: 'Насколько ваша кожа склонна к покраснениям и раздражениям?' },
    });
    console.log('✅ Текст вопроса обновлён на "Насколько ваша кожа склонна к покраснениям и раздражениям?"');

    // Новые варианты ответов
    const newOptions = [
      'Практически никогда, кожа устойчивая',
      'Легкое покраснение, которое быстро проходит',
      'Заметное покраснение и дискомфорт, который может сохраняться',
      'Сильное и стойкое покраснение, возможны диагнозы (розацеа, дерматит)',
    ];

    // Обновляем варианты ответов
    for (let i = 0; i < newOptions.length; i++) {
      const newLabel = newOptions[i];
      const existingOption = question.answerOptions[i];

      if (existingOption) {
        // Обновляем существующий вариант
        await prisma.answerOption.update({
          where: { id: existingOption.id },
          data: { label: newLabel },
        });
        console.log(`   ✅ Позиция ${i + 1}: "${existingOption.label}" → "${newLabel}"`);
      } else {
        // Создаем новый вариант, если его нет
        const value = `skin_sensitivity_${i + 1}`;
        await prisma.answerOption.create({
          data: {
            questionId: question.id,
            value: value,
            label: newLabel,
            position: i + 1,
            scoreJson: createScoreJson('skin_sensitivity', newLabel, i),
          },
        });
        console.log(`   ✅ Создан новый вариант на позиции ${i + 1}: "${newLabel}"`);
      }
    }

    // Удаляем лишние варианты, если их больше, чем нужно
    if (question.answerOptions.length > newOptions.length) {
      const optionsToDelete = question.answerOptions.slice(newOptions.length);
      for (const option of optionsToDelete) {
        await prisma.answerOption.delete({
          where: { id: option.id },
        });
        console.log(`   🗑️ Удалён лишний вариант: "${option.label}"`);
      }
    }

    console.log('\n✅ Обновление завершено!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Функция для создания scoreJson на основе нового текста варианта
function createScoreJson(questionCode: string, optionLabel: string, index: number): any {
  if (questionCode === 'skin_sensitivity') {
    // Маппинг новых вариантов на уровни чувствительности
    if (optionLabel.includes('Практически никогда') || optionLabel.includes('устойчивая')) {
      return { sensitivity: 0 };
    }
    if (optionLabel.includes('Легкое покраснение') || optionLabel.includes('быстро проходит')) {
      return { sensitivity: 1 };
    }
    if (optionLabel.includes('Заметное покраснение') || optionLabel.includes('может сохраняться')) {
      return { sensitivity: 2 };
    }
    if (optionLabel.includes('Сильное') || optionLabel.includes('розацеа') || optionLabel.includes('дерматит')) {
      return { sensitivity: 3 };
    }
    // Fallback на индекс
    return { sensitivity: index };
  }
  return null;
}

updateSkinSensitivityQuestion()
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
