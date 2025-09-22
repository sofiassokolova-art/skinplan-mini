/**
 * Примеры использования BotHelp API
 */

import { botHelpAPI } from './bothelp';

// Пример 1: Тестирование подключения
export async function testBotConnection() {
  console.log('🔍 Тестируем подключение к боту...');
  
  const isConnected = await botHelpAPI.testConnection();
  
  if (isConnected) {
    console.log('✅ Подключение успешно!');
    
    // Получаем информацию о боте
    const botInfo = await botHelpAPI.getBotInfo();
    console.log('📋 Информация о боте:', botInfo);
    
    return true;
  } else {
    console.log('❌ Не удалось подключиться к боту');
    return false;
  }
}

// Пример 2: Отправка сообщения пользователю
export async function sendWelcomeMessage(chatId: string, userName?: string) {
  const message = userName 
    ? `Привет, ${userName}! 👋 Добро пожаловать в SkinPlan!`
    : 'Привет! 👋 Добро пожаловать в SkinPlan!';
  
  const success = await botHelpAPI.sendMessage(chatId, message, {
    keyboard: {
      type: 'inline',
      buttons: [
        [
          { text: '📸 Анализ кожи', callback_data: 'skin_analysis' },
          { text: '📋 План ухода', callback_data: 'care_plan' }
        ],
        [
          { text: '🛒 Каталог', callback_data: 'catalog' },
          { text: '📞 Поддержка', callback_data: 'support' }
        ]
      ]
    }
  });
  
  if (success) {
    console.log(`✅ Приветственное сообщение отправлено в чат ${chatId}`);
  } else {
    console.log(`❌ Не удалось отправить сообщение в чат ${chatId}`);
  }
  
  return success;
}

// Пример 3: Работа с переменными пользователя
export async function saveUserSkinData(userId: string, skinData: {
  skinType: string;
  concerns: string[];
  age: number;
  routine: string;
}) {
  const success = await botHelpAPI.setUserVariables(userId, {
    skin_type: skinData.skinType,
    skin_concerns: skinData.concerns.join(','),
    age: skinData.age,
    current_routine: skinData.routine,
    last_analysis_date: new Date().toISOString(),
  });
  
  if (success) {
    console.log(`✅ Данные о коже сохранены для пользователя ${userId}`);
  } else {
    console.log(`❌ Не удалось сохранить данные для пользователя ${userId}`);
  }
  
  return success;
}

// Пример 4: Получение данных пользователя
export async function getUserSkinProfile(userId: string) {
  const variables = await botHelpAPI.getUserVariables(userId);
  
  if (variables) {
    const skinProfile = {
      skinType: variables.skin_type,
      concerns: variables.skin_concerns ? variables.skin_concerns.split(',') : [],
      age: variables.age,
      routine: variables.current_routine,
      lastAnalysis: variables.last_analysis_date,
    };
    
    console.log(`📊 Профиль кожи пользователя ${userId}:`, skinProfile);
    return skinProfile;
  } else {
    console.log(`❌ Не удалось получить данные пользователя ${userId}`);
    return null;
  }
}

// Пример 5: Отправка персонализированного плана ухода
export async function sendPersonalizedPlan(chatId: string, userId: string) {
  const skinProfile = await getUserSkinProfile(userId);
  
  if (!skinProfile) {
    await botHelpAPI.sendMessage(chatId, 'Сначала пройдите анализ кожи, чтобы получить персонализированный план!');
    return false;
  }
  
  const planMessage = `
🎯 **Ваш персонализированный план ухода:**

**Тип кожи:** ${skinProfile.skinType}
**Основные проблемы:** ${skinProfile.concerns.join(', ')}
**Возраст:** ${skinProfile.age} лет

**Рекомендуемый уход:**
🌅 **Утром:**
• Очищение мягким гелем
• Тонизирование
• Увлажняющий крем с SPF

🌙 **Вечером:**
• Демакияж
• Очищение
• Сыворотка с активными компонентами
• Ночной крем

Хотите получить подробные рекомендации по продуктам?
  `;
  
  const success = await botHelpAPI.sendMessage(chatId, planMessage, {
    keyboard: {
      type: 'inline',
      buttons: [
        [
          { text: '🛒 Рекомендуемые продукты', callback_data: 'recommended_products' },
          { text: '📋 Детальный план', callback_data: 'detailed_plan' }
        ],
        [
          { text: '🔄 Новый анализ', callback_data: 'new_analysis' }
        ]
      ]
    }
  });
  
  return success;
}

// Пример 6: Обработка входящих сообщений (для вебхуков)
export async function handleIncomingMessage(message: any) {
  const { chat_id, text, user_id } = message;
  
  console.log(`📨 Получено сообщение от ${user_id}: ${text}`);
  
  // Простая обработка команд
  switch (text.toLowerCase()) {
    case '/start':
      await sendWelcomeMessage(chat_id);
      break;
      
    case '/profile':
      await getUserSkinProfile(user_id);
      break;
      
    case '/plan':
      await sendPersonalizedPlan(chat_id, user_id);
      break;
      
    case '/help':
      await botHelpAPI.sendMessage(chat_id, `
🤖 **Доступные команды:**

/start - Начать работу с ботом
/profile - Посмотреть профиль кожи
/plan - Получить план ухода
/help - Показать эту справку

Или используйте кнопки меню для навигации!
      `);
      break;
      
    default:
      // Обработка обычных сообщений
      await botHelpAPI.sendMessage(chat_id, 'Я понимаю! Давайте найдем подходящий план ухода для вашей кожи. Используйте /start для начала анализа.');
  }
}

// Пример 7: Интеграция с анализом кожи
export async function processSkinAnalysis(chatId: string, userId: string, analysisData: any) {
  // Сохраняем результаты анализа
  await botHelpAPI.setUserVariables(userId, {
    last_analysis: JSON.stringify(analysisData),
    analysis_date: new Date().toISOString(),
  });
  
  // Отправляем результаты
  const resultsMessage = `
🔬 **Результаты анализа кожи:**

**Тип кожи:** ${analysisData.skinType}
**Уровень увлажненности:** ${analysisData.hydration}%
**Пигментация:** ${analysisData.pigmentation}
**Морщины:** ${analysisData.wrinkles}
**Поры:** ${analysisData.pores}

**Рекомендации:**
${analysisData.recommendations.map((rec: string) => `• ${rec}`).join('\n')}

Хотите получить персонализированный план ухода?
  `;
  
  await botHelpAPI.sendMessage(chatId, resultsMessage, {
    keyboard: {
      type: 'inline',
      buttons: [
        [
          { text: '📋 Получить план ухода', callback_data: 'get_plan' },
          { text: '🛒 Рекомендуемые продукты', callback_data: 'products' }
        ]
      ]
    }
  });
}


