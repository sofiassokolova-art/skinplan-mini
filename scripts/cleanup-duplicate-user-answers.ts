// scripts/cleanup-duplicate-user-answers.ts
// Скрипт для обнаружения и очистки дубликатов UserAnswer
// Дубликаты определяются по (userId, questionnaireId, questionId)
// Оставляет только самую новую запись для каждой комбинации

import { prisma } from '../lib/db';

async function cleanupDuplicateUserAnswers() {
  console.log('🔄 Поиск и очистка дубликатов UserAnswer...\n');

  try {
    // Находим все дубликаты используя группировку
    // Используем raw query для эффективного поиска дубликатов
    const duplicates = await prisma.$queryRaw<Array<{
      user_id: string;
      questionnaire_id: number;
      question_id: number;
      count: bigint;
    }>>`
      SELECT 
        user_id,
        questionnaire_id,
        question_id,
        COUNT(*) as count
      FROM user_answers
      GROUP BY user_id, questionnaire_id, question_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено');
      await prisma.$disconnect();
      return;
    }

    console.log(`⚠️  Найдено ${duplicates.length} групп дубликатов:\n`);

    let totalDuplicatesToDelete = 0;
    let totalDeleted = 0;

    // Обрабатываем каждую группу дубликатов
    for (const dup of duplicates) {
      const count = Number(dup.count);
      const toDelete = count - 1; // Оставляем один, удаляем остальные
      totalDuplicatesToDelete += toDelete;

      console.log(`📋 Группа: userId=${dup.user_id}, questionnaireId=${dup.questionnaire_id}, questionId=${dup.question_id}`);
      console.log(`   Всего записей: ${count}, будет удалено: ${toDelete}`);

      // Находим все записи для этой группы
      const records = await prisma.userAnswer.findMany({
        where: {
          userId: dup.user_id,
          questionnaireId: dup.questionnaire_id,
          questionId: dup.question_id,
        },
        orderBy: {
          createdAt: 'desc', // Сортируем по дате создания (новые первыми)
        },
      });

      // Оставляем самую новую запись, удаляем остальные
      const toDeleteRecords = records.slice(1); // Все кроме первой (самой новой)

      if (toDeleteRecords.length > 0) {
        const idsToDelete = toDeleteRecords.map(r => r.id);
        
        // Удаляем дубликаты
        const deleteResult = await prisma.userAnswer.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });

        totalDeleted += deleteResult.count;
        console.log(`   ✅ Удалено ${deleteResult.count} записей (оставлена самая новая)\n`);
      }
    }

    console.log('\n📊 Итоги:');
    console.log(`   Групп дубликатов: ${duplicates.length}`);
    console.log(`   Записей к удалению: ${totalDuplicatesToDelete}`);
    console.log(`   Записей удалено: ${totalDeleted}`);

    // Проверяем, остались ли дубликаты
    const remainingDuplicates = await prisma.$queryRaw<Array<{
      user_id: string;
      questionnaire_id: number;
      question_id: number;
      count: bigint;
    }>>`
      SELECT 
        user_id,
        questionnaire_id,
        question_id,
        COUNT(*) as count
      FROM user_answers
      GROUP BY user_id, questionnaire_id, question_id
      HAVING COUNT(*) > 1
    `;

    if (remainingDuplicates.length === 0) {
      console.log('\n✅ Все дубликаты успешно удалены!');
    } else {
      console.log(`\n⚠️  Внимание: осталось ${remainingDuplicates.length} групп дубликатов`);
    }

  } catch (error: any) {
    console.error('❌ Ошибка при очистке дубликатов:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
cleanupDuplicateUserAnswers()
  .then(() => {
    console.log('\n✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

