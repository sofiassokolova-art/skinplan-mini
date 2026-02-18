// scripts/verify-questionnaire-complete.ts
// Полная проверка анкеты: БД, API логика, структура данных

import { prisma } from '../lib/db';

async function verifyQuestionnaireComplete() {
  try {
    console.log('\n🔍 Полная проверка анкеты\n');
    console.log('='.repeat(60));

    // 1. Проверка БД напрямую
    console.log('\n📋 1. Проверка БД (Prisma):');
    const dbQuestionnaire = await prisma.questionnaire.findFirst({
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
          where: { groupId: null },
          include: {
            answerOptions: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!dbQuestionnaire) {
      console.log('   ❌ Активная анкета не найдена в БД!');
      return;
    }

    console.log(`   ✅ Анкета найдена: ID=${dbQuestionnaire.id}, Name="${dbQuestionnaire.name}"`);
    
    const dbGroups = dbQuestionnaire.questionGroups || [];
    const dbPlainQuestions = dbQuestionnaire.questions || [];
    const dbGroupsQuestionsCount = dbGroups.reduce((sum, g) => sum + (g.questions?.length || 0), 0);
    const dbTotalQuestionsCount = dbGroupsQuestionsCount + dbPlainQuestions.length;

    console.log(`   Групп: ${dbGroups.length}`);
    console.log(`   Вопросов в группах: ${dbGroupsQuestionsCount}`);
    console.log(`   Вопросов без группы: ${dbPlainQuestions.length}`);
    console.log(`   Всего вопросов: ${dbTotalQuestionsCount}`);

    // 2. Симуляция API запроса
    console.log('\n📋 2. Симуляция API запроса (/api/questionnaire/active):');
    const apiQuestionnaire = await prisma.questionnaire.findFirst({
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
          where: { groupId: null },
          include: {
            answerOptions: {
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!apiQuestionnaire) {
      console.log('   ❌ Анкета не найдена при симуляции API!');
      return;
    }

    const apiGroups = apiQuestionnaire.questionGroups || [];
    const apiPlainQuestions = apiQuestionnaire.questions || [];
    const apiGroupsQuestionsCount = apiGroups.reduce((sum, g) => sum + (g.questions?.length || 0), 0);
    const apiTotalQuestionsCount = apiGroupsQuestionsCount + apiPlainQuestions.length;

    console.log(`   ✅ API запрос успешен`);
    console.log(`   Групп: ${apiGroups.length}`);
    console.log(`   Вопросов в группах: ${apiGroupsQuestionsCount}`);
    console.log(`   Вопросов без группы: ${apiPlainQuestions.length}`);
    console.log(`   Всего вопросов: ${apiTotalQuestionsCount}`);

    // 3. Форматирование как в API
    console.log('\n📋 3. Форматирование данных (как в API):');
    const formatted = {
      id: apiQuestionnaire.id,
      name: apiQuestionnaire.name,
      version: apiQuestionnaire.version,
      groups: apiGroups.map(group => ({
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
      questions: apiPlainQuestions.map(q => ({
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

    console.log(`   ✅ Форматирование успешно`);
    console.log(`   formatted.groups.length: ${formatted.groups.length}`);
    console.log(`   formatted.questions.length: ${formatted.questions.length}`);
    console.log(`   Всего вопросов в formatted: ${formattedTotalQuestionsCount}`);

    // 4. Проверка структуры (как на фронтенде)
    console.log('\n📋 4. Симуляция фронтенда (allQuestionsRaw):');
    const groups = formatted.groups || [];
    const questions = formatted.questions || [];
    
    const questionsFromGroups: any[] = [];
    const seenIds = new Set<number>();
    
    groups.forEach((g) => {
      const groupQuestions = g?.questions || [];
      groupQuestions.forEach((q: any) => {
        if (q && q.id && !seenIds.has(q.id)) {
          questionsFromGroups.push(q);
          seenIds.add(q.id);
        }
      });
    });
    
    const questionsMap = new Map<number, any>();
    questionsFromGroups.forEach((q: any) => {
      if (q && q.id && !questionsMap.has(q.id)) {
        questionsMap.set(q.id, q);
      }
    });
    
    questions.forEach((q: any) => {
      if (q && q.id && !questionsMap.has(q.id)) {
        questionsMap.set(q.id, q);
      }
    });
    
    const allQuestionsRaw = Array.from(questionsMap.values());
    
    console.log(`   ✅ allQuestionsRaw создан`);
    console.log(`   allQuestionsRaw.length: ${allQuestionsRaw.length}`);
    console.log(`   questionsFromGroups.length: ${questionsFromGroups.length}`);
    console.log(`   questions.length: ${questions.length}`);

    // 5. Итоговая проверка
    console.log('\n📊 5. Итоговая проверка:');
    console.log(`   БД: ${dbTotalQuestionsCount} вопросов`);
    console.log(`   API: ${apiTotalQuestionsCount} вопросов`);
    console.log(`   Formatted: ${formattedTotalQuestionsCount} вопросов`);
    console.log(`   Frontend (allQuestionsRaw): ${allQuestionsRaw.length} вопросов`);

    if (dbTotalQuestionsCount === 0) {
      console.log('\n❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: В БД нет вопросов!');
      console.log('   💡 Решение: Запустите seed скрипт');
      console.log('      npx tsx scripts/seed-questionnaire-v2.ts');
    } else if (apiTotalQuestionsCount === 0) {
      console.log('\n❌ ПРОБЛЕМА: API не возвращает вопросы!');
      console.log('   💡 Проверьте логику в app/api/questionnaire/active/route.ts');
    } else if (formattedTotalQuestionsCount === 0) {
      console.log('\n❌ ПРОБЛЕМА: Форматирование удаляет вопросы!');
      console.log('   💡 Проверьте логику форматирования в API');
    } else if (allQuestionsRaw.length === 0) {
      console.log('\n❌ ПРОБЛЕМА: Фронтенд не может извлечь вопросы!');
      console.log('   💡 Проверьте логику allQuestionsRaw в quiz/page.tsx');
    } else if (dbTotalQuestionsCount !== apiTotalQuestionsCount || 
               apiTotalQuestionsCount !== formattedTotalQuestionsCount ||
               formattedTotalQuestionsCount !== allQuestionsRaw.length) {
      console.log('\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Несоответствие количества вопросов на разных этапах!');
      console.log('   💡 Проверьте логику на каждом этапе');
    } else {
      console.log('\n✅ ВСЁ В ПОРЯДКЕ! Все этапы возвращают одинаковое количество вопросов.');
      console.log(`   Активная анкета содержит ${dbTotalQuestionsCount} вопросов и готова к использованию.`);
    }

    // 6. Детальная информация о группах
    console.log('\n📦 6. Детали групп:');
    formatted.groups.forEach((group, index) => {
      console.log(`   ${index + 1}. "${group.title}" (ID: ${group.id}):`);
      console.log(`      Вопросов: ${group.questions.length}`);
      if (group.questions.length === 0) {
        console.log(`      ⚠️  Группа пустая!`);
      } else {
        group.questions.forEach((q, qIndex) => {
          const optionsCount = q.options?.length || 0;
          console.log(`         ${qIndex + 1}. "${q.text.substring(0, 40)}..." (ID: ${q.id}, code: ${q.code}, options: ${optionsCount})`);
        });
      }
    });

  } catch (error) {
    console.error('\n❌ Ошибка при проверке:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

verifyQuestionnaireComplete();

