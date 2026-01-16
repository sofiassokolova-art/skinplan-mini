// scripts/remove-emojis-from-lifestyle-habits.ts
// Скрипт для удаления эмодзи из вариантов ответов вопроса lifestyle_habits

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг старых label (с эмодзи) на новые (без эмодзи)
const EMOJI_REMOVAL_MAP: Record<string, string> = {
  'Курю 🚬': 'Курю',
  'Употребляю алкоголь 🍷': 'Употребляю алкоголь',
  'Часто не высыпаюсь 😴': 'Часто не высыпаюсь',
  'Испытываю стресс ⚡': 'Испытываю стресс',
  'Ем много сладкого 🍩': 'Ем много сладкого',
  'Ем много фастфуда 🍔': 'Ем много фастфуда',
};

// Функция для удаления эмодзи из строки (на случай, если есть другие варианты)
function removeEmojis(text: string): string {
  // Удаляем все эмодзи (Unicode диапазоны для эмодзи)
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Различные символы и пиктограммы
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Разные символы
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Разные символы
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Эмодзи лиц
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Транспорт и карты
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Флаги
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Дополнительные символы
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Шахматы
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Символы и пиктограммы
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Варианты выбора
    .replace(/[\u{200D}]/gu, '') // Zero-width joiner
    .replace(/[\u{20E3}]/gu, '') // Combining enclosing keycap
    .replace(/\s+/g, ' ') // Убираем лишние пробелы
    .trim();
}

async function removeEmojisFromLifestyleHabits() {
  console.log('🔄 Удаляю эмодзи из вариантов ответов вопроса lifestyle_habits...');

  try {
    // Находим вопрос lifestyle_habits
    const question = await prisma.question.findFirst({
      where: { code: 'lifestyle_habits' },
      include: { answerOptions: { orderBy: { position: 'asc' } } },
    });

    if (!question) {
      console.log('❌ Вопрос lifestyle_habits не найден');
      return;
    }

    console.log(`✅ Найден вопрос: ${question.text} (ID: ${question.id})`);
    console.log(`   Вариантов ответов: ${question.answerOptions.length}`);

    // Обновляем варианты ответов
    let updatedCount = 0;
    for (const option of question.answerOptions) {
      let newLabel: string | null = null;

      // Сначала проверяем маппинг
      if (EMOJI_REMOVAL_MAP[option.label]) {
        newLabel = EMOJI_REMOVAL_MAP[option.label];
      } else {
        // Если нет в маппинге, удаляем эмодзи программно
        const cleanedLabel = removeEmojis(option.label);
        if (cleanedLabel !== option.label) {
          newLabel = cleanedLabel;
        }
      }

      if (newLabel && newLabel !== option.label) {
        await prisma.answerOption.update({
          where: { id: option.id },
          data: { label: newLabel },
        });
        console.log(`   ✅ Позиция ${option.position}: "${option.label}" → "${newLabel}"`);
        updatedCount++;
      } else {
        console.log(`   ⏭️ Позиция ${option.position}: "${option.label}" (без изменений)`);
      }
    }

    console.log(`\n✅ Обновление завершено! Обновлено вариантов: ${updatedCount}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeEmojisFromLifestyleHabits()
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });
