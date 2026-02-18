// scripts/test-api-http.ts
// Тестирование реального HTTP API endpoint

async function testAPIHTTP() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const endpoint = '/api/questionnaire/active';
  const url = `${baseUrl}${endpoint}`;

  console.log('\n🔍 Тестирование HTTP API endpoint\n');
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
        console.log(`   Это означает, что API вернул пустые данные`);
      } else {
        console.log(`\n✅ API вернул ${totalQuestionsCount} вопросов - всё в порядке!`);
      }

      // Проверяем метаданные
      if (data._meta) {
        console.log(`\n📋 Метаданные:`);
        console.log(`   shouldRedirectToPlan: ${data._meta.shouldRedirectToPlan}`);
        console.log(`   isCompleted: ${data._meta.isCompleted}`);
        console.log(`   hasProfile: ${data._meta.hasProfile}`);
      }

    } else if (response.status === 500) {
      console.log(`\n❌ API вернул ошибку 500:`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log(`   Message: ${data.message || 'No message'}`);
      console.log(`   Questionnaire ID: ${data.questionnaireId || 'N/A'}`);
      
      if (data._meta) {
        console.log(`   _meta.hasQuestionsInDB: ${data._meta.hasQuestionsInDB}`);
        console.log(`   _meta.prismaIssue: ${data._meta.prismaIssue}`);
      }
    } else {
      console.log(`\n⚠️  API вернул неожиданный статус:`);
      console.log(`   Data:`, JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Ошибка при вызове API:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
    console.log('\n💡 Убедитесь, что сервер запущен: npm run dev');
  }
}

testAPIHTTP();

