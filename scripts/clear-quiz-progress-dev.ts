// scripts/clear-quiz-progress-dev.ts
// Очищает ТОЛЬКО прогресс анкеты (questionnaire_progress) и ответы (UserAnswer)
// для локального dev-пользователя Telegram (по умолчанию 987654322).

import { prisma } from '../lib/db';

const TELEGRAM_ID = process.env.NEXT_PUBLIC_DEV_TELEGRAM_ID || '987654322';

async function clearQuizProgressForDevUser() {
  console.log('🔄 Очищаю прогресс анкеты для локального dev-пользователя...');
  console.log(`   Telegram ID: ${TELEGRAM_ID}\n`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: TELEGRAM_ID },
      select: { id: true },
    });

    if (!user) {
      console.log('⚠️ Пользователь с таким telegramId не найден в БД. Возможно, вы еще не открывали миниапп.');
      return;
    }

    const userId = user.id;
    console.log(`📋 Найден userId: ${userId}`);

    // Удаляем только ответы анкеты и прогресс анкеты
    const answersDeleted = await prisma.userAnswer.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ UserAnswer: удалено ${answersDeleted.count}`);

    try {
      const deletedProgress: any = await prisma.$executeRawUnsafe(
        'DELETE FROM questionnaire_progress WHERE user_id = $1',
        userId,
      );
      console.log('   ✅ questionnaire_progress: записи удалены');
    } catch (e: any) {
      console.warn('   ⚠️ Не удалось удалить из questionnaire_progress через raw SQL:', e?.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

clearQuizProgressForDevUser()
  .then(() => {
    console.log('\n✅ Очистка прогресса завершена.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Ошибка при очистке прогресса:', err);
    process.exit(1);
  });

