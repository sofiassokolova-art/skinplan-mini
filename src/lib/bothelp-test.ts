/**
 * Тестовая среда для BotHelp API
 * ВАЖНО: Этот файл только для тестирования, не для продакшна!
 */

import { BotHelpAPI, BotHelpConfig } from './bothelp';

// Тестовые данные
const TEST_CONFIG: BotHelpConfig = {
  botId: '300658:b15c4f51bffd31f6667e50f37a20a025',
  secret: '300658:c5d3ccb085f4a1fb6dd0984da2514a52',
  baseUrl: 'https://api.bothelp.io', // или тестовый URL если есть
};

// Мок-данные для тестирования
export const MOCK_DATA = {
  testChatId: 'test_chat_12345',
  testUserId: 'test_user_67890',
  testMessages: [
    {
      id: 'msg_1',
      text: 'Привет! Хочу проанализировать свою кожу',
      timestamp: Date.now() - 1000,
      userId: 'test_user_67890',
      chatId: 'test_chat_12345',
    },
    {
      id: 'msg_2', 
      text: 'У меня комбинированная кожа, есть проблемы с акне',
      timestamp: Date.now() - 500,
      userId: 'test_user_67890',
      chatId: 'test_chat_12345',
    }
  ],
  testUser: {
    id: 'test_user_67890',
    name: 'Тестовый Пользователь',
    phone: '+7 (999) 123-45-67',
    email: 'test@example.com',
    customFields: {
      skin_type: 'combination',
      age: 25,
      concerns: 'acne,oily_t_zone'
    }
  }
};

// Тестовый класс API с логированием
export class TestBotHelpAPI extends BotHelpAPI {
  private isTestMode: boolean = true;
  private testLogs: string[] = [];

  constructor(config: BotHelpConfig, testMode: boolean = true) {
    super(config);
    this.isTestMode = testMode;
  }

  // Переопределяем методы для тестового режима
  async sendMessage(chatId: string, text: string, options?: any): Promise<boolean> {
    if (this.isTestMode) {
      this.log(`🧪 ТЕСТ: Отправка сообщения в чат ${chatId}`);
      this.log(`📝 Текст: ${text}`);
      if (options) {
        this.log(`⚙️ Опции: ${JSON.stringify(options, null, 2)}`);
      }
      this.log('✅ Сообщение "отправлено" (тестовый режим)');
      return true;
    }
    
    return super.sendMessage(chatId, text, options);
  }

  async getUserInfo(userId: string): Promise<any> {
    if (this.isTestMode) {
      this.log(`🧪 ТЕСТ: Получение информации о пользователе ${userId}`);
      this.log('📊 Возвращаем мок-данные пользователя');
      return MOCK_DATA.testUser;
    }
    
    return super.getUserInfo(userId);
  }

  async getChatHistory(chatId: string, limit: number = 50): Promise<any[]> {
    if (this.isTestMode) {
      this.log(`🧪 ТЕСТ: Получение истории чата ${chatId}`);
      this.log(`📜 Возвращаем ${MOCK_DATA.testMessages.length} тестовых сообщений`);
      return MOCK_DATA.testMessages;
    }
    
    return super.getChatHistory(chatId, limit);
  }

  async setUserVariables(userId: string, variables: Record<string, any>): Promise<boolean> {
    if (this.isTestMode) {
      this.log(`🧪 ТЕСТ: Установка переменных для пользователя ${userId}`);
      this.log(`📝 Переменные: ${JSON.stringify(variables, null, 2)}`);
      this.log('✅ Переменные "сохранены" (тестовый режим)');
      return true;
    }
    
    return super.setUserVariables(userId, variables);
  }

  async getUserVariables(userId: string): Promise<Record<string, any> | null> {
    if (this.isTestMode) {
      this.log(`🧪 ТЕСТ: Получение переменных пользователя ${userId}`);
      this.log('📊 Возвращаем мок-данные переменных');
      return MOCK_DATA.testUser.customFields;
    }
    
    return super.getUserVariables(userId);
  }

  async testConnection(): Promise<boolean> {
    if (this.isTestMode) {
      this.log('🧪 ТЕСТ: Проверка подключения к API');
      this.log('✅ Подключение "успешно" (тестовый режим)');
      return true;
    }
    
    return super.testConnection();
  }

  async getBotInfo(): Promise<any> {
    if (this.isTestMode) {
      this.log('🧪 ТЕСТ: Получение информации о боте');
      const mockBotInfo = {
        id: TEST_CONFIG.botId,
        name: 'SkinPlan Test Bot',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        test_mode: true
      };
      this.log('📋 Возвращаем мок-данные бота');
      return mockBotInfo;
    }
    
    return super.getBotInfo();
  }

  // Вспомогательные методы для тестирования
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.testLogs.push(logMessage);
    console.log(logMessage);
  }

  getTestLogs(): string[] {
    return [...this.testLogs];
  }

  clearTestLogs(): void {
    this.testLogs = [];
  }

  setTestMode(enabled: boolean): void {
    this.isTestMode = enabled;
    this.log(`🔄 Режим тестирования ${enabled ? 'включен' : 'выключен'}`);
  }
}

// Создаем тестовый экземпляр API
export const testBotHelpAPI = new TestBotHelpAPI(TEST_CONFIG, true);

// Функции для тестирования
export async function runBotTests() {
  console.log('🚀 Запуск тестов BotHelp API...\n');
  
  // Тест 1: Проверка подключения
  console.log('=== ТЕСТ 1: Проверка подключения ===');
  const connectionTest = await testBotHelpAPI.testConnection();
  console.log(`Результат: ${connectionTest ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  // Тест 2: Получение информации о боте
  console.log('=== ТЕСТ 2: Информация о боте ===');
  const botInfo = await testBotHelpAPI.getBotInfo();
  console.log('Информация о боте:', botInfo);
  console.log(`Результат: ${botInfo ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  // Тест 3: Отправка сообщения
  console.log('=== ТЕСТ 3: Отправка сообщения ===');
  const messageTest = await testBotHelpAPI.sendMessage(
    MOCK_DATA.testChatId,
    'Привет! Это тестовое сообщение от SkinPlan бота.',
    {
      keyboard: {
        type: 'inline',
        buttons: [
          [{ text: 'Тест кнопка', callback_data: 'test_button' }]
        ]
      }
    }
  );
  console.log(`Результат: ${messageTest ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  // Тест 4: Работа с пользователем
  console.log('=== ТЕСТ 4: Информация о пользователе ===');
  const userInfo = await testBotHelpAPI.getUserInfo(MOCK_DATA.testUserId);
  console.log('Информация о пользователе:', userInfo);
  console.log(`Результат: ${userInfo ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  // Тест 5: Переменные пользователя
  console.log('=== ТЕСТ 5: Переменные пользователя ===');
  const setVars = await testBotHelpAPI.setUserVariables(MOCK_DATA.testUserId, {
    test_variable: 'test_value',
    skin_analysis_completed: true,
    last_test_date: new Date().toISOString()
  });
  console.log(`Установка переменных: ${setVars ? '✅ Успешно' : '❌ Ошибка'}`);
  
  const getVars = await testBotHelpAPI.getUserVariables(MOCK_DATA.testUserId);
  console.log('Полученные переменные:', getVars);
  console.log(`Результат: ${getVars ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  // Тест 6: История чата
  console.log('=== ТЕСТ 6: История чата ===');
  const chatHistory = await testBotHelpAPI.getChatHistory(MOCK_DATA.testChatId);
  console.log('История чата:', chatHistory);
  console.log(`Результат: ${chatHistory.length > 0 ? '✅ Успешно' : '❌ Ошибка'}\n`);
  
  console.log('🏁 Тестирование завершено!');
  console.log('\n📋 Логи тестирования:');
  testBotHelpAPI.getTestLogs().forEach(log => console.log(log));
}

// Функция для тестирования интеграции с SkinPlan
export async function testSkinPlanIntegration() {
  console.log('🧪 Тестирование интеграции SkinPlan с BotHelp...\n');
  
  // Симуляция анализа кожи
  const mockSkinAnalysis = {
    skinType: 'combination',
    hydration: 75,
    pigmentation: 'light',
    wrinkles: 'minimal',
    pores: 'visible',
    concerns: ['acne', 'oily_t_zone'],
    recommendations: [
      'Используйте мягкое очищение',
      'Добавьте увлажняющий крем',
      'Применяйте SPF ежедневно'
    ]
  };
  
  // Сохраняем результаты анализа
  console.log('💾 Сохранение результатов анализа...');
  await testBotHelpAPI.setUserVariables(MOCK_DATA.testUserId, {
    skin_analysis: JSON.stringify(mockSkinAnalysis),
    analysis_date: new Date().toISOString(),
    analysis_completed: true
  });
  
  // Отправляем результаты пользователю
  console.log('📤 Отправка результатов пользователю...');
  const resultsMessage = `
🔬 **Результаты анализа кожи (ТЕСТ):**

**Тип кожи:** ${mockSkinAnalysis.skinType}
**Уровень увлажненности:** ${mockSkinAnalysis.hydration}%
**Пигментация:** ${mockSkinAnalysis.pigmentation}
**Морщины:** ${mockSkinAnalysis.wrinkles}
**Поры:** ${mockSkinAnalysis.pores}

**Рекомендации:**
${mockSkinAnalysis.recommendations.map(rec => `• ${rec}`).join('\n')}

*Это тестовые данные для проверки интеграции*
  `;
  
  await testBotHelpAPI.sendMessage(MOCK_DATA.testChatId, resultsMessage, {
    keyboard: {
      type: 'inline',
      buttons: [
        [
          { text: '📋 Получить план ухода', callback_data: 'get_plan' },
          { text: '🛒 Рекомендуемые продукты', callback_data: 'products' }
        ],
        [
          { text: '🔄 Новый анализ', callback_data: 'new_analysis' }
        ]
      ]
    }
  });
  
  console.log('✅ Интеграция протестирована успешно!');
}

// Экспорт для использования в других файлах
export default {
  testBotHelpAPI,
  runBotTests,
  testSkinPlanIntegration,
  MOCK_DATA
};


