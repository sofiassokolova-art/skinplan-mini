/**
 * Webhook обработчик для BotHelp
 * Обрабатывает входящие сообщения от бота
 */

import { handleChildDevelopmentMessage } from './child-development-flow';
import { testBotHelpAPI } from './bothelp-test';

// Типы входящих сообщений
export interface BotHelpWebhookMessage {
  message_id: string;
  chat_id: string;
  user_id: string;
  text?: string;
  callback_data?: string;
  timestamp: number;
  message_type: 'text' | 'callback' | 'command';
}

// Обработчик входящих webhook'ов
export class BotHelpWebhookHandler {
  private isTestMode: boolean = true;

  constructor(testMode: boolean = true) {
    this.isTestMode = testMode;
  }

  // Основной обработчик webhook'а
  async handleWebhook(payload: any): Promise<{ status: string; message: string }> {
    try {
      console.log('📨 Получен webhook от BotHelp:', JSON.stringify(payload, null, 2));

      // Извлекаем данные сообщения
      const message = this.extractMessageData(payload);
      
      if (!message) {
        return { status: 'error', message: 'Не удалось извлечь данные сообщения' };
      }

      console.log(`📝 Обработка сообщения от ${message.user_id}: ${message.text || message.callback_data}`);

      // Обрабатываем сообщение
      await this.processMessage(message);

      return { status: 'success', message: 'Сообщение обработано успешно' };

    } catch (error) {
      console.error('❌ Ошибка обработки webhook:', error);
      return { status: 'error', message: `Ошибка: ${error.message}` };
    }
  }

  // Извлечение данных сообщения из payload
  private extractMessageData(payload: any): BotHelpWebhookMessage | null {
    try {
      // Адаптируем под структуру BotHelp API
      const message: BotHelpWebhookMessage = {
        message_id: payload.message_id || payload.id || Date.now().toString(),
        chat_id: payload.chat_id || payload.chat?.id || 'unknown',
        user_id: payload.user_id || payload.user?.id || payload.from?.id || 'unknown',
        text: payload.text || payload.message?.text,
        callback_data: payload.callback_data || payload.data,
        timestamp: payload.timestamp || payload.date || Date.now(),
        message_type: payload.callback_data ? 'callback' : 'text'
      };

      return message;
    } catch (error) {
      console.error('Ошибка извлечения данных сообщения:', error);
      return null;
    }
  }

  // Обработка сообщения
  private async processMessage(message: BotHelpWebhookMessage): Promise<void> {
    const { chat_id, user_id, text, callback_data, message_type } = message;

    // Логируем входящее сообщение
    if (this.isTestMode) {
      console.log(`🧪 ТЕСТ: Обработка ${message_type} сообщения`);
      console.log(`   Чат: ${chat_id}`);
      console.log(`   Пользователь: ${user_id}`);
      console.log(`   Текст: ${text || 'N/A'}`);
      console.log(`   Callback: ${callback_data || 'N/A'}`);
    }

    // Обрабатываем команды
    if (text && text.startsWith('/')) {
      await this.handleCommand(chat_id, user_id, text);
      return;
    }

    // Обрабатываем поток диагностики развития ребенка
    await handleChildDevelopmentMessage(chat_id, user_id, text || '', callback_data);
  }

  // Обработка команд
  private async handleCommand(chatId: string, userId: string, command: string): Promise<void> {
    console.log(`🤖 Обработка команды: ${command}`);

    switch (command.toLowerCase()) {
      case '/start':
        await this.handleStartCommand(chatId, userId);
        break;
        
      case '/help':
        await this.handleHelpCommand(chatId);
        break;
        
      case '/reset':
        await this.handleResetCommand(chatId, userId);
        break;
        
      case '/status':
        await this.handleStatusCommand(chatId, userId);
        break;
        
      default:
        await testBotHelpAPI.sendMessage(chatId, `Неизвестная команда: ${command}\nИспользуйте /help для получения справки.`);
    }
  }

  // Команда /start
  private async handleStartCommand(chatId: string, userId: string): Promise<void> {
    const welcomeMessage = `
👋 **Добро пожаловать в диагностику развития ребенка!**

Я помогу вам проверить, развивается ли ваш ребенок согласно нормам ВОЗ.

🚀 Начнем диагностику?
    `;

    await testBotHelpAPI.sendMessage(chatId, welcomeMessage, {
      keyboard: {
        type: 'inline',
        buttons: [
          [{ text: '🚀 Начать диагностику', callback_data: 'start_diagnosis' }]
        ]
      }
    });
  }

  // Команда /help
  private async handleHelpCommand(chatId: string): Promise<void> {
    const helpMessage = `
🤖 **Доступные команды:**

/start - Начать диагностику развития ребенка
/help - Показать эту справку
/reset - Сбросить данные и начать заново
/status - Показать текущий статус

📋 **О диагностике:**
• Разработано по методике ВОЗ
• Занимает 10 минут
• Персональные рекомендации
• Пошаговый план развития
    `;

    await testBotHelpAPI.sendMessage(chatId, helpMessage);
  }

  // Команда /reset
  private async handleResetCommand(chatId: string, userId: string): Promise<void> {
    // Сбрасываем все переменные пользователя
    await testBotHelpAPI.setUserVariables(userId, {
      parent_name: null,
      child_age_group: null,
      exact_age: null,
      flow_state: 'welcome',
      flow_completed: false
    });

    await testBotHelpAPI.sendMessage(chatId, '🔄 Данные сброшены. Начинаем заново!');
    
    // Запускаем поток заново
    await this.handleStartCommand(chatId, userId);
  }

  // Команда /status
  private async handleStatusCommand(chatId: string, userId: string): Promise<void> {
    const userVars = await testBotHelpAPI.getUserVariables(userId);
    
    if (!userVars || !userVars.parent_name) {
      await testBotHelpAPI.sendMessage(chatId, '📊 Статус: Диагностика не начата\nИспользуйте /start для начала.');
      return;
    }

    const statusMessage = `
📊 **Текущий статус:**

👤 **Родитель:** ${userVars.parent_name}
👶 **Возрастная группа:** ${userVars.child_age_group || 'не выбрана'}
📅 **Точный возраст:** ${userVars.exact_age_label || 'не выбран'}
🔄 **Состояние:** ${userVars.flow_state || 'неизвестно'}
✅ **Завершено:** ${userVars.flow_completed ? 'Да' : 'Нет'}

${userVars.flow_completed ? '🎯 Готовы к диагностике!' : '⏳ Продолжайте настройку...'}
    `;

    await testBotHelpAPI.sendMessage(chatId, statusMessage);
  }

  // Тестирование webhook'а
  async testWebhook(): Promise<void> {
    console.log('🧪 Тестирование webhook обработчика...\n');

    // Тест 1: Команда /start
    console.log('=== ТЕСТ 1: Команда /start ===');
    await this.handleWebhook({
      message_id: 'test_1',
      chat_id: 'test_chat',
      user_id: 'test_user',
      text: '/start',
      timestamp: Date.now()
    });

    // Тест 2: Ввод имени
    console.log('\n=== ТЕСТ 2: Ввод имени ===');
    await this.handleWebhook({
      message_id: 'test_2',
      chat_id: 'test_chat',
      user_id: 'test_user',
      text: 'Анна',
      timestamp: Date.now()
    });

    // Тест 3: Выбор возрастной группы
    console.log('\n=== ТЕСТ 3: Выбор возрастной группы ===');
    await this.handleWebhook({
      message_id: 'test_3',
      chat_id: 'test_chat',
      user_id: 'test_user',
      callback_data: 'age_under_1',
      timestamp: Date.now()
    });

    // Тест 4: Выбор точного возраста
    console.log('\n=== ТЕСТ 4: Выбор точного возраста ===');
    await this.handleWebhook({
      message_id: 'test_4',
      chat_id: 'test_chat',
      user_id: 'test_user',
      callback_data: 'age_6_to_7_months',
      timestamp: Date.now()
    });

    // Тест 5: Команда /status
    console.log('\n=== ТЕСТ 5: Команда /status ===');
    await this.handleWebhook({
      message_id: 'test_5',
      chat_id: 'test_chat',
      user_id: 'test_user',
      text: '/status',
      timestamp: Date.now()
    });

    console.log('\n✅ Тестирование webhook завершено!');
  }
}

// Создаем экземпляр обработчика
export const webhookHandler = new BotHelpWebhookHandler(true);

// Экспорт для использования в других файлах
export default {
  BotHelpWebhookHandler,
  webhookHandler,
  BotHelpWebhookMessage
};


