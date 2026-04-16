// scripts/test-production-api.ts
// Тестирование API на продакшене

async function testProductionAPI() {
  const baseUrl = process.env.PRODUCTION_BASE_URL || 'https://skinplan-mini.pages.dev';
  const endpoint = '/api/questionnaire/active';
  const url = `${baseUrl}${endpoint}`;

  console.log('\n🔍 Тестирование API на продакшене\n');
  console.log('='.repeat(60));
  console.log(`URL: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.status === 200) {
      console.log(`\n✅ API вернул успешный ответ:`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Name: "${data.name}"`);
      console.log(`   Version: ${data.version}`);
      console.log(`   Groups: ${data.groups?.length || 0}`);
      console.log(`   Questions (plain): ${data.questions?.length || 0}`);

      const groupsQuestionsCount = (data.groups || []).reduce(
        (sum: number, g: any) => sum + (g.questions?.length || 0),
        0
      );
      const totalQuestionsCount = groupsQuestionsCount + (data.questions?.length || 0);

      console.log(`   Questions in groups: ${groupsQuestionsCount}`);
      console.log(`   Total questions: ${totalQuestionsCount}`);

      if (totalQuestionsCount === 0) {
        console.log(`\n❌ ПРОБЛЕМА: API вернул 0 вопросов!`);
        console.log(`   Это означает, что миграции не применены или данные не загружены`);
      } else {
        console.log(`\n✅ API вернул ${totalQuestionsCount} вопросов - миграции работают корректно!`);
      }

      // Проверяем метаданные
      if (data._meta) {
        console.log(`\n📋 Метаданные:`);
        console.log(`   shouldRedirectToPlan: ${data._meta.shouldRedirectToPlan}`);
        console.log(`   isCompleted: ${data._meta.isCompleted}`);
        console.log(`   hasProfile: ${data._meta.hasProfile}`);
      }

      return { success: true, totalQuestions: totalQuestionsCount };

    } else if (response.status === 500) {
      console.log(`\n❌ API вернул ошибку 500:`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log(`   Message: ${data.message || 'No message'}`);
      console.log(`   Questionnaire ID: ${data.questionnaireId || 'N/A'}`);
      
      if (data._meta) {
        console.log(`   _meta.hasQuestionsInDB: ${data._meta.hasQuestionsInDB}`);
        console.log(`   _meta.prismaIssue: ${data._meta.prismaIssue}`);
      }

      // Проверяем, является ли это ошибкой отсутствия таблицы
      if (data.error === 'Database schema not initialized' || 
          data.message?.includes('таблица') || 
          data.message?.includes('table')) {
        console.log(`\n❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Миграции не применены в продакшене!`);
        console.log(`   Необходимо применить миграции: npx prisma migrate deploy`);
      }

      return { success: false, error: data.error, message: data.message };

    } else {
      console.log(`\n⚠️  API вернул неожиданный статус:`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));
      return { success: false, status: response.status, data };
    }

  } catch (error) {
    console.error('\n❌ Ошибка при вызове API:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

testProductionAPI().then(result => {
  console.log('\n📊 Итоговый результат:', result);
  process.exit(result.success ? 0 : 1);
});

