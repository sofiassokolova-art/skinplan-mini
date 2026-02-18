// scripts/test-api-questionnaire.ts
// Тестирование API endpoint для получения активной анкеты

import { prisma } from '../lib/db';

async function testAPIQuestionnaire() {
  try {
    console.log('\n🔍 Тестирование логики API /api/questionnaire/active\n');
    console.log('='.repeat(60));

    // Симулируем запрос, как в API
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

    const groups = questionnaire.questionGroups || [];
    const plainQuestions = questionnaire.questions || [];
    const groupsQuestionsCount = groups.reduce(
      (sum, g) => sum + (g.questions?.length || 0),
      0
    );
    const totalQuestionsCount = groupsQuestionsCount + plainQuestions.length;

    console.log(`\n📊 Результаты запроса:`);
    console.log(`   groups.length: ${groups.length}`);
    console.log(`   plainQuestions.length: ${plainQuestions.length}`);
    console.log(`   groupsQuestionsCount: ${groupsQuestionsCount}`);
    console.log(`   totalQuestionsCount: ${totalQuestionsCount}`);

    // Проверяем структуру данных
    console.log(`\n🔍 Детали групп:`);
    groups.forEach((group, index) => {
      const questions = group.questions || [];
      console.log(`   ${index + 1}. Группа "${group.title}" (ID: ${group.id}):`);
      console.log(`      questions.length: ${questions.length}`);
      console.log(`      questions:`, questions.map(q => ({ id: q.id, code: q.code, text: q.text.substring(0, 30) + '...' })));
    });

    // Форматируем как в API
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

    console.log(`\n📦 Форматированные данные:`);
    console.log(`   formatted.groups.length: ${formatted.groups.length}`);
    console.log(`   formatted.questions.length: ${formatted.questions.length}`);
    
    const totalFormattedQuestions = formatted.groups.reduce(
      (sum, g) => sum + (g.questions?.length || 0),
      0
    ) + formatted.questions.length;
    console.log(`   Всего вопросов в formatted: ${totalFormattedQuestions}`);

    if (totalFormattedQuestions === 0) {
      console.log('\n❌ ПРОБЛЕМА: После форматирования вопросов нет!');
      console.log('\n🔍 Детали форматирования:');
      formatted.groups.forEach((group, index) => {
        console.log(`   Группа ${index + 1}: "${group.title}"`);
        console.log(`      questions.length: ${group.questions.length}`);
        if (group.questions.length === 0) {
          console.log(`      ⚠️  Группа пустая после форматирования!`);
          const originalGroup = groups.find(g => g.id === group.id);
          console.log(`      Оригинальная группа questions.length: ${originalGroup?.questions?.length || 0}`);
        }
      });
    } else {
      console.log('\n✅ Форматированные данные содержат вопросы - всё в порядке!');
    }

    // Проверяем, что все вопросы имеют answerOptions
    console.log(`\n🔍 Проверка answerOptions:`);
    let questionsWithoutOptions = 0;
    formatted.groups.forEach(group => {
      group.questions.forEach(q => {
        if (!q.options || q.options.length === 0) {
          questionsWithoutOptions++;
          console.log(`   ⚠️  Вопрос "${q.text.substring(0, 30)}..." (ID: ${q.id}) не имеет options`);
        }
      });
    });
    formatted.questions.forEach(q => {
      if (!q.options || q.options.length === 0) {
        questionsWithoutOptions++;
        console.log(`   ⚠️  Вопрос "${q.text.substring(0, 30)}..." (ID: ${q.id}) не имеет options`);
      }
    });
    
    if (questionsWithoutOptions === 0) {
      console.log(`   ✅ Все вопросы имеют answerOptions`);
    } else {
      console.log(`   ⚠️  Найдено ${questionsWithoutOptions} вопросов без options`);
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAPIQuestionnaire();

