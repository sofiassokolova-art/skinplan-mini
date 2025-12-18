// scripts/clear-all-users-progress.ts
// Очистка прогресса плана для всех пользователей

import { prisma } from '../lib/db';

async function clearAllUsersProgress() {
  console.log('🔄 Очистка прогресса плана для всех пользователей...\n');
  
  try {
    // Подсчитываем количество записей прогресса
    const progressCount = await prisma.planProgress.count({});
    console.log(`📊 Найдено записей прогресса: ${progressCount}`);
    
    if (progressCount === 0) {
      console.log('✅ Прогресс уже пуст, нечего удалять');
      await prisma.$disconnect();
      return;
    }
    
    // Удаляем все записи прогресса
    console.log('📋 Удаляю все записи PlanProgress...');
    try {
      const deleted = await prisma.planProgress.deleteMany({});
      console.log(`   ✅ Удалено записей прогресса: ${deleted.count}`);
    } catch (progressError: any) {
      if (progressError?.code === 'P2022' || progressError?.message?.includes('completed_days')) {
        console.log('   ⚠️ PlanProgress не удален (проблема со схемой БД)');
        console.log('   Попробуйте удалить вручную через Prisma Studio или SQL');
      } else {
        console.error('   ❌ Ошибка при удалении PlanProgress:', progressError?.message);
        throw progressError;
      }
    }
    
    // Проверяем, что все удалено
    const remainingCount = await prisma.planProgress.count({});
    
    console.log('\n✅ Очистка завершена!');
    console.log(`   Осталось записей прогресса: ${remainingCount}`);
    
    if (remainingCount > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: Некоторые записи не были удалены!');
      console.log('   Возможно, проблема со схемой БД (completed_days)');
    } else {
      console.log('\n✅ Прогресс всех пользователей успешно обнулен!');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsersProgress()
  .then(() => {
    console.log('\n🎉 Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });
