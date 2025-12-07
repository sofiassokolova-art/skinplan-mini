// scripts/clear-all-users-progress.ts
// Скрипт для очистки прогресса анкеты для всех пользователей
// Это обнулит конверсию в админке, так как она вычисляется динамически на основе этих данных

import { PrismaClient } from '@prisma/client';
import { invalidateAllUserCache } from '../lib/cache';

const prisma = new PrismaClient();

async function clearAllUsersProgress() {
  console.log('\n🗑️  ОЧИСТКА ПРОГРЕССА АНКЕТЫ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ\n');
  console.log('⚠️  ВНИМАНИЕ: Это действие удалит все ответы на анкету, профили и планы для всех пользователей!');
  console.log('⚠️  Конверсия в админке автоматически обнулится, так как она вычисляется на основе этих данных.\n');
  
  try {
    // Получаем общее количество пользователей
    const totalUsers = await prisma.user.count();
    console.log(`📊 Всего пользователей в системе: ${totalUsers}\n`);

    // 1. Удаляем ответы на анкету (UserAnswer) - это обнулит startedQuiz и completedQuizCount
    console.log('📋 Удаляю ответы на анкету для всех пользователей...');
    const answersDeleted = await prisma.userAnswer.deleteMany({});
    console.log(`   ✅ Удалено ответов: ${answersDeleted.count}`);

    // 2. Удаляем профили кожи (SkinProfile) - это удалит все связанные данные
    console.log('📋 Удаляю профили кожи для всех пользователей...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({});
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);

    // 3. Удаляем сессии рекомендаций (RecommendationSession) - это обнулит hasPlan
    console.log('📋 Удаляю сессии рекомендаций для всех пользователей...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({});
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);

    // 4. Удаляем прогресс плана (PlanProgress)
    console.log('📋 Удаляю прогресс плана для всех пользователей...');
    const progressDeleted = await prisma.planProgress.deleteMany({});
    console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);

    // 5. Удаляем отзывы на план (PlanFeedback)
    console.log('📋 Удаляю отзывы на план для всех пользователей...');
    const feedbackDeleted = await prisma.planFeedback.deleteMany({});
    console.log(`   ✅ Удалено отзывов: ${feedbackDeleted.count}`);

    // 6. Инвалидируем весь кэш для всех пользователей
    console.log('📋 Инвалидирую кэш для всех пользователей...');
    try {
      await invalidateAllUserCache();
      console.log(`   ✅ Кэш инвалидирован для всех пользователей`);
    } catch (error) {
      console.warn(`   ⚠️  Ошибка при инвалидации кэша (может быть недоступен): ${error}`);
    }

    // Проверяем результат
    const finalAnswersCount = await prisma.userAnswer.count();
    const finalProfilesCount = await prisma.skinProfile.count();
    const finalSessionsCount = await prisma.recommendationSession.count();
    const finalProgressCount = await prisma.planProgress.count();

    console.log('\n🎉 Очистка прогресса завершена успешно!');
    console.log(`📊 Финальное состояние:`);
    console.log(`   - Ответов на анкету: ${finalAnswersCount}`);
    console.log(`   - Профилей кожи: ${finalProfilesCount}`);
    console.log(`   - Сессий рекомендаций: ${finalSessionsCount}`);
    console.log(`   - Записей прогресса: ${finalProgressCount}`);
    console.log(`\n✅ Конверсия в админке автоматически обнулится при следующем запросе!`);
    console.log(`✅ Все пользователи могут пройти анкету заново как новые пользователи!\n`);

  } catch (error) {
    console.error('❌ Ошибка при очистке прогресса:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
clearAllUsersProgress()
  .then(() => {
    console.log('✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

