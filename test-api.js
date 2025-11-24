// test-api.js
// Простой скрипт для тестирования API роутов

const API_BASE = 'http://localhost:3000';

async function testQuestionnaire() {
  console.log('🧪 Тестирование /api/questionnaire/active...');
  try {
    const response = await fetch(`${API_BASE}/api/questionnaire/active`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Анкета загружена успешно');
      console.log(`   ID: ${data.id}`);
      console.log(`   Название: ${data.name}`);
      console.log(`   Версия: ${data.version}`);
      console.log(`   Групп: ${data.groups?.length || 0}`);
      
      const totalQuestions = data.groups?.reduce((sum, g) => sum + (g.questions?.length || 0), 0) || 0;
      console.log(`   Вопросов: ${totalQuestions}`);
      
      return true;
    } else {
      console.error('❌ Ошибка:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка соединения:', error.message);
    console.log('   Убедитесь, что сервер запущен: npm run dev');
    return false;
  }
}

async function testAuth() {
  console.log('\n🧪 Тестирование /api/auth/telegram...');
  console.log('   (Нужен реальный initData от Telegram)');
  console.log('   Этот тест пропускается в автоматическом режиме');
  return true;
}

async function runTests() {
  console.log('🚀 Начало тестирования API\n');
  
  // Ждем 2 секунды, чтобы сервер точно запустился
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = {
    questionnaire: await testQuestionnaire(),
    auth: await testAuth(),
  };
  
  console.log('\n📊 Результаты:');
  console.log(`   Анкета: ${results.questionnaire ? '✅' : '❌'}`);
  console.log(`   Авторизация: ⏭️  (требует Telegram)`);
  
  if (results.questionnaire) {
    console.log('\n✅ Базовые тесты прошли успешно!');
  } else {
    console.log('\n❌ Есть проблемы. Проверьте:');
    console.log('   1. Сервер запущен (npm run dev)');
    console.log('   2. База данных подключена (DATABASE_URL в .env)');
    console.log('   3. Анкета заполнена (npm run seed:questionnaire-full)');
  }
}

runTests().catch(console.error);

