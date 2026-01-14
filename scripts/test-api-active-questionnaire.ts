// scripts/test-api-active-questionnaire.ts
// Тестирование API endpoint /api/questionnaire/active в реальном времени

import { prisma } from '../lib/db';

async function testAPIActiveQuestionnaire() {
  try {
    console.log('\n🔍 Тестирование API /api/questionnaire/active\n');
    console.log('='.repeat(60));

    // Симулируем точно такой же запрос, как в API route
    console.log('\n📋 Выполняем Prisma запрос (как в API route):');
    
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: {
                  orderBy: { position: 'asc' },
                },
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
            answerOptions: {
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!questionnaire) {
      console.log('❌ Активная анкета не найдена');
      return;
    }

    console.log(`✅ Анкета найдена: ID=${questionnaire.id}, Name="${questionnaire.name}"`);

    // Проверяем структуру данных
    const groups = questionnaire.questionGroups || [];
    const plainQuestions = questionnaire.questions || [];
    
    console.log(`\n📊 Структура данных из Prisma:`);
    console.log(`   groups.length: ${groups.length}`);
    console.log(`   plainQuestions.length: ${plainQuestions.length}`);
    console.log(`   groups type: ${typeof groups}, isArray: ${Array.isArray(groups)}`);
    console.log(`   plainQuestions type: ${typeof plainQuestions}, isArray: ${Array.isArray(plainQuestions)}`);

    // Проверяем каждую группу
    console.log(`\n📦 Детали групп:`);
    groups.forEach((g, index) => {
      const qCount = Array.isArray(g.questions) ? g.questions.length : 0;
      console.log(`   ${index + 1}. "${g.title}" (ID: ${g.id}):`);
      console.log(`      questions type: ${typeof g.questions}, isArray: ${Array.isArray(g.questions)}`);
      console.log(`      questions count: ${qCount}`);
      if (qCount > 0 && Array.isArray(g.questions)) {
        console.log(`      sample questions: ${g.questions.slice(0, 2).map((q: any) => q.code).join(', ')}`);
      }
    });

    // Подсчитываем вопросы
    const groupsQuestionsCount = groups.reduce(
      (sum, g) => {
        const qCount = Array.isArray(g.questions) ? g.questions.length : 0;
        return sum + qCount;
      },
      0
    );
    const totalQuestionsCount = groupsQuestionsCount + plainQuestions.length;

    console.log(`\n📊 Подсчет вопросов:`);
    console.log(`   groupsQuestionsCount: ${groupsQuestionsCount}`);
    console.log(`   plainQuestions.length: ${plainQuestions.length}`);
    console.log(`   totalQuestionsCount: ${totalQuestionsCount}`);

    // Проверяем БД напрямую
    console.log(`\n🔍 Проверка БД напрямую:`);
    const directQuestionsCount = await prisma.question.count({
      where: { questionnaireId: questionnaire.id },
    });
    const directQuestionsInGroupsCount = await prisma.question.count({
      where: {
        questionnaireId: questionnaire.id,
        groupId: { not: null },
      },
    });
    const directQuestionsWithoutGroupCount = await prisma.question.count({
      where: {
        questionnaireId: questionnaire.id,
        groupId: null,
      },
    });

    console.log(`   directQuestionsCount: ${directQuestionsCount}`);
    console.log(`   directQuestionsInGroupsCount: ${directQuestionsInGroupsCount}`);
    console.log(`   directQuestionsWithoutGroupCount: ${directQuestionsWithoutGroupCount}`);

    // Сравниваем результаты
    console.log(`\n📊 Сравнение результатов:`);
    console.log(`   Prisma totalQuestionsCount: ${totalQuestionsCount}`);
    console.log(`   Direct DB count: ${directQuestionsCount}`);
    
    if (totalQuestionsCount === 0 && directQuestionsCount > 0) {
      console.log(`\n❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Prisma не вернул вопросы, хотя они есть в БД!`);
      console.log(`   Это проблема с Prisma запросом или структурой данных`);
    } else if (totalQuestionsCount === 0 && directQuestionsCount === 0) {
      console.log(`\n❌ ПРОБЛЕМА: В БД действительно нет вопросов`);
    } else if (totalQuestionsCount !== directQuestionsCount) {
      console.log(`\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Несоответствие количества вопросов`);
      console.log(`   Prisma: ${totalQuestionsCount}, БД: ${directQuestionsCount}`);
    } else {
      console.log(`\n✅ ВСЁ В ПОРЯДКЕ: Prisma вернул все вопросы из БД`);
    }

    // Проверяем форматирование (как в API)
    console.log(`\n📋 Форматирование данных (как в API):`);
    const formatted = {
      id: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groups: groups.map(group => ({
        id: group.id,
        title: group.title,
        position: group.position,
        questions: (group.questions || []).map(q => ({
          id: q.id,
          code: q.code,
          text: q.text,
          type: q.type,
          position: q.position,
          isRequired: q.isRequired,
          options: (q.answerOptions || []).map(opt => ({
            id: opt.id,
            value: opt.value,
            label: opt.label,
            position: opt.position,
          })),
        })),
      })),
      questions: plainQuestions.map(q => ({
        id: q.id,
        code: q.code,
        text: q.text,
        type: q.type,
        position: q.position,
        isRequired: q.isRequired,
        options: (q.answerOptions || []).map(opt => ({
          id: opt.id,
          value: opt.value,
          label: opt.label,
          position: opt.position,
        })),
      })),
    };

    const formattedGroupsQuestionsCount = formatted.groups.reduce(
      (sum, g) => sum + (g.questions?.length || 0),
      0
    );
    const formattedTotalQuestionsCount = formattedGroupsQuestionsCount + formatted.questions.length;

    console.log(`   formatted.groups.length: ${formatted.groups.length}`);
    console.log(`   formatted.questions.length: ${formatted.questions.length}`);
    console.log(`   formattedTotalQuestionsCount: ${formattedTotalQuestionsCount}`);

    if (formattedTotalQuestionsCount === 0) {
      console.log(`\n❌ ПРОБЛЕМА: Форматирование удалило все вопросы!`);
    } else {
      console.log(`\n✅ Форматирование успешно: ${formattedTotalQuestionsCount} вопросов`);
    }

    // Итоговая проверка
    console.log(`\n📊 ИТОГОВАЯ ПРОВЕРКА:`);
    console.log(`   БД (direct): ${directQuestionsCount} вопросов`);
    console.log(`   Prisma (raw): ${totalQuestionsCount} вопросов`);
    console.log(`   Formatted: ${formattedTotalQuestionsCount} вопросов`);
    
    if (totalQuestionsCount === 0) {
      console.log(`\n❌ API вернет 500 ошибку: totalQuestionsCount === 0`);
      if (directQuestionsCount > 0) {
        console.log(`   Причина: Prisma не вернул вопросы, хотя они есть в БД`);
      } else {
        console.log(`   Причина: В БД нет вопросов`);
      }
    } else {
      console.log(`\n✅ API вернет успешный ответ с ${formattedTotalQuestionsCount} вопросами`);
    }

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании API:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAPIActiveQuestionnaire();

