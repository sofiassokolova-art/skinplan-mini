// scripts/check-questionnaire-db.ts
// Проверка состояния анкеты в базе данных

import { prisma } from '../lib/db';

async function checkQuestionnaireDB() {
  try {
    console.log('\n🔍 Проверка анкеты в базе данных\n');
    console.log('='.repeat(60));

    // 1. Проверяем все анкеты
    console.log('\n📋 1. Все анкеты в базе:');
    const allQuestionnaires = await prisma.questionnaire.findMany({
      orderBy: { version: 'desc' },
    });
    
    if (allQuestionnaires.length === 0) {
      console.log('   ❌ В базе нет ни одной анкеты!');
      return;
    }
    
    console.log(`   Всего анкет: ${allQuestionnaires.length}`);
    allQuestionnaires.forEach(q => {
      console.log(`   - ID: ${q.id}, Name: "${q.name}", Version: ${q.version}, Active: ${q.isActive ? '✅' : '❌'}`);
    });

    // 2. Проверяем активную анкету
    console.log('\n📋 2. Активная анкета:');
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: true,
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        questions: {
          where: {
            groupId: null, // Вопросы без группы
          },
          include: {
            answerOptions: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!activeQuestionnaire) {
      console.log('   ❌ Нет активной анкеты (isActive: true)!');
      console.log('\n💡 Решение:');
      console.log('   1. Установите isActive: true для одной из анкет');
      console.log('   2. Или создайте новую анкету и установите isActive: true');
      return;
    }

    console.log(`   ✅ Активная анкета найдена:`);
    console.log(`      ID: ${activeQuestionnaire.id}`);
    console.log(`      Name: "${activeQuestionnaire.name}"`);
    console.log(`      Version: ${activeQuestionnaire.version}`);
    console.log(`      Created: ${activeQuestionnaire.createdAt}`);

    // 3. Проверяем группы вопросов
    const groups = activeQuestionnaire.questionGroups || [];
    console.log(`\n📦 3. Группы вопросов: ${groups.length}`);
    
    if (groups.length === 0) {
      console.log('   ⚠️  В активной анкете нет групп вопросов!');
    } else {
      groups.forEach((group, index) => {
        const questionsInGroup = group.questions || [];
        console.log(`   ${index + 1}. "${group.title}" (ID: ${group.id}, position: ${group.position})`);
        console.log(`      Вопросов в группе: ${questionsInGroup.length}`);
        
        if (questionsInGroup.length === 0) {
          console.log(`      ⚠️  Группа пустая!`);
        } else {
          questionsInGroup.forEach((q, qIndex) => {
            const optionsCount = q.answerOptions?.length || 0;
            console.log(`         ${qIndex + 1}. "${q.text}" (ID: ${q.id}, code: ${q.code}, type: ${q.type}, options: ${optionsCount})`);
          });
        }
      });
    }

    // 4. Проверяем вопросы без группы
    const plainQuestions = activeQuestionnaire.questions || [];
    console.log(`\n📝 4. Вопросы без группы: ${plainQuestions.length}`);
    
    if (plainQuestions.length === 0) {
      console.log('   ℹ️  Нет вопросов без группы (это нормально)');
    } else {
      plainQuestions.forEach((q, index) => {
        const optionsCount = q.answerOptions?.length || 0;
        console.log(`   ${index + 1}. "${q.text}" (ID: ${q.id}, code: ${q.code}, type: ${q.type}, options: ${optionsCount})`);
      });
    }

    // 5. Подсчитываем общее количество вопросов
    const groupsQuestionsCount = groups.reduce(
      (sum, g) => sum + (g.questions?.length || 0),
      0
    );
    const totalQuestionsCount = groupsQuestionsCount + plainQuestions.length;

    console.log(`\n📊 5. Итого:`);
    console.log(`   Групп: ${groups.length}`);
    console.log(`   Вопросов в группах: ${groupsQuestionsCount}`);
    console.log(`   Вопросов без группы: ${plainQuestions.length}`);
    console.log(`   Всего вопросов: ${totalQuestionsCount}`);

    if (totalQuestionsCount === 0) {
      console.log('\n❌ ПРОБЛЕМА: Активная анкета пустая (нет вопросов)!');
      console.log('\n💡 Решение:');
      console.log('   1. Запустите seed скрипт: npm run seed:questionnaire');
      console.log('   2. Или создайте вопросы вручную через Prisma Studio: npx prisma studio');
      console.log('   3. Или используйте скрипт seed-questionnaire.ts для создания вопросов');
    } else {
      console.log('\n✅ Активная анкета содержит вопросы - всё в порядке!');
    }

    // 6. Проверяем все вопросы в базе (для диагностики)
    console.log(`\n🔍 6. Все вопросы в базе (для диагностики):`);
    const allQuestions = await prisma.question.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
      },
      include: {
        group: true,
        answerOptions: true,
      },
      orderBy: [
        { groupId: 'asc' },
        { position: 'asc' },
      ],
    });

    console.log(`   Всего вопросов с questionnaireId=${activeQuestionnaire.id}: ${allQuestions.length}`);
    
    const questionsByGroup = allQuestions.reduce((acc, q) => {
      const key = q.groupId ? `group_${q.groupId}` : 'no_group';
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    }, {} as Record<string, typeof allQuestions>);

    Object.entries(questionsByGroup).forEach(([key, questions]) => {
      if (key === 'no_group') {
        console.log(`   - Без группы: ${questions.length} вопросов`);
      } else {
        const groupId = key.replace('group_', '');
        const group = groups.find(g => g.id === Number(groupId));
        console.log(`   - Группа "${group?.title || 'unknown'}": ${questions.length} вопросов`);
      }
    });

    // 7. Проверяем связи
    console.log(`\n🔗 7. Проверка связей:`);
    const allGroups = await prisma.questionGroup.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
      },
    });
    console.log(`   Групп с questionnaireId=${activeQuestionnaire.id}: ${allGroups.length}`);
    
    if (allGroups.length !== groups.length) {
      console.log(`   ⚠️  Несоответствие: найдено ${allGroups.length} групп, но в include только ${groups.length}`);
    }

    const questionsWithWrongQuestionnaireId = await prisma.question.findMany({
      where: {
        questionnaireId: { not: activeQuestionnaire.id },
      },
      take: 5,
    });
    
    if (questionsWithWrongQuestionnaireId.length > 0) {
      console.log(`   ⚠️  Найдено ${questionsWithWrongQuestionnaireId.length} вопросов с другим questionnaireId`);
    } else {
      console.log(`   ✅ Все вопросы привязаны к активной анкете`);
    }

  } catch (error) {
    console.error('\n❌ Ошибка при проверке базы данных:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkQuestionnaireDB();

