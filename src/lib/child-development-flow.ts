/**
 * Поток диагностики развития ребенка
 * Тестовая среда для BotHelp
 */

import { testBotHelpAPI, MOCK_DATA } from './bothelp-test';

// Типы данных для потока
export interface ChildDevelopmentData {
  parentName: string;
  childAge: 'under_1' | 'over_1';
  exactAge: string;
  timestamp: string;
}

// Состояния потока
export enum FlowState {
  WELCOME = 'welcome',
  GET_NAME = 'get_name',
  GET_AGE_GROUP = 'get_age_group',
  GET_EXACT_AGE = 'get_exact_age',
  COMPLETED = 'completed'
}

// Возрастные группы
export const AGE_GROUPS = {
  under_1: [
    { value: 'less_1_month', label: 'менее 1 месяца' },
    { value: '1_to_2_months', label: 'от 1 месяца до 2х' },
    { value: '2_to_3_months', label: 'от 2х месяцев до 3х месяцев' },
    { value: '3_to_4_months', label: 'от 3 месяцев до 4 месяцев' },
    { value: '4_to_5_months', label: 'от 4 до 5 месяцев' },
    { value: '5_to_6_months', label: 'от 5 до 6 месяцев' },
    { value: '6_to_7_months', label: 'от 6 месяцев до 7 месяцев' },
    { value: '7_to_8_months', label: 'от 7 месяцев до 8 месяцев' },
    { value: '8_to_9_months', label: 'от 8 месяцев до 9 месяцев' },
    { value: '9_to_10_months', label: 'от 9 месяцев до 10 месяцев' },
    { value: '10_to_11_months', label: 'от 10 месяцев до 11 месяцев' },
    { value: '11_to_12_months', label: 'от 11 месяцев до 12 месяцев' }
  ],
  over_1: [
    { value: '1_to_1_5_years', label: 'от 1 года до 1,5 лет' },
    { value: '1_5_to_2_years', label: 'от 1,5 лет до 2х лет' },
    { value: '2_to_3_years', label: 'от 2х лет до 3 лет' },
    { value: '3_to_4_years', label: 'от 3х лет до 4 лет' },
    { value: '4_to_5_years', label: 'от 4х лет до 5 лет' },
    { value: '5_to_6_years', label: 'от 5 до 6 лет' }
  ]
};

// Класс для управления потоком
export class ChildDevelopmentFlow {
  private chatId: string;
  private userId: string;
  private currentState: FlowState = FlowState.WELCOME;
  private userData: Partial<ChildDevelopmentData> = {};

  constructor(chatId: string, userId: string) {
    this.chatId = chatId;
    this.userId = userId;
  }

  // Начало потока - приветственное сообщение
  async startFlow(): Promise<void> {
    console.log('🚀 Запуск потока диагностики развития ребенка');
    
    const welcomeMessage = `
👶 **Развивается ли ребенок согласно нормам?**

Пройди уникальную диагностику развития ребенка за 10 минут и получи пошаговый план развития

📋 Разработано по методике ВОЗ с персональными рекомендациями от ведущих специалистов по детскому развитию
    `;

    await testBotHelpAPI.sendMessage(this.chatId, welcomeMessage, {
      keyboard: {
        type: 'inline',
        buttons: [
          [{ text: '🚀 Начать', callback_data: 'start_diagnosis' }]
        ]
      }
    });

    this.currentState = FlowState.GET_NAME;
  }

  // Обработка ответов пользователя
  async handleUserResponse(message: string, callbackData?: string): Promise<void> {
    console.log(`📨 Получен ответ: "${message}" (callback: ${callbackData})`);
    console.log(`📍 Текущее состояние: ${this.currentState}`);

    switch (this.currentState) {
      case FlowState.GET_NAME:
        await this.handleNameInput(message);
        break;
        
      case FlowState.GET_AGE_GROUP:
        await this.handleAgeGroupSelection(callbackData || message);
        break;
        
      case FlowState.GET_EXACT_AGE:
        await this.handleExactAgeSelection(callbackData || message);
        break;
        
      default:
        console.log('⚠️ Неожиданное состояние потока');
    }
  }

  // Обработка ввода имени
  private async handleNameInput(name: string): Promise<void> {
    if (!name.trim()) {
      await testBotHelpAPI.sendMessage(this.chatId, 'Пожалуйста, введите ваше имя');
      return;
    }

    this.userData.parentName = name.trim();
    console.log(`👤 Имя пользователя сохранено: ${this.userData.parentName}`);

    // Сохраняем имя в переменные пользователя
    await testBotHelpAPI.setUserVariables(this.userId, {
      parent_name: this.userData.parentName,
      flow_state: FlowState.GET_AGE_GROUP
    });

    const ageGroupMessage = `Приятно познакомиться, ${this.userData.parentName}! 👋

**Какой возраст у ребенка?**`;

    await testBotHelpAPI.sendMessage(this.chatId, ageGroupMessage, {
      keyboard: {
        type: 'inline',
        buttons: [
          [
            { text: '👶 до 1 года', callback_data: 'age_under_1' },
            { text: '🧒 более 1 года', callback_data: 'age_over_1' }
          ]
        ]
      }
    });

    this.currentState = FlowState.GET_AGE_GROUP;
  }

  // Обработка выбора возрастной группы
  private async handleAgeGroupSelection(selection: string): Promise<void> {
    let ageGroup: 'under_1' | 'over_1';
    
    if (selection === 'age_under_1' || selection.includes('до 1 года')) {
      ageGroup = 'under_1';
    } else if (selection === 'age_over_1' || selection.includes('более 1 года')) {
      ageGroup = 'over_1';
    } else {
      await testBotHelpAPI.sendMessage(this.chatId, 'Пожалуйста, выберите один из предложенных вариантов');
      return;
    }

    this.userData.childAge = ageGroup;
    console.log(`👶 Возрастная группа выбрана: ${ageGroup}`);

    // Сохраняем выбор
    await testBotHelpAPI.setUserVariables(this.userId, {
      child_age_group: ageGroup,
      flow_state: FlowState.GET_EXACT_AGE
    });

    // Показываем кнопки для точного возраста
    await this.showExactAgeButtons(ageGroup);
    this.currentState = FlowState.GET_EXACT_AGE;
  }

  // Показ кнопок точного возраста
  private async showExactAgeButtons(ageGroup: 'under_1' | 'over_1'): Promise<void> {
    const ageOptions = AGE_GROUPS[ageGroup];
    const buttons = [];

    // Разбиваем кнопки по 2 в ряд
    for (let i = 0; i < ageOptions.length; i += 2) {
      const row = [];
      row.push({ text: ageOptions[i].label, callback_data: `age_${ageOptions[i].value}` });
      
      if (i + 1 < ageOptions.length) {
        row.push({ text: ageOptions[i + 1].label, callback_data: `age_${ageOptions[i + 1].value}` });
      }
      
      buttons.push(row);
    }

    const exactAgeMessage = `**Выберите точный возраст малыша:**`;

    await testBotHelpAPI.sendMessage(this.chatId, exactAgeMessage, {
      keyboard: {
        type: 'inline',
        buttons
      }
    });
  }

  // Обработка выбора точного возраста
  private async handleExactAgeSelection(selection: string): Promise<void> {
    // Извлекаем значение возраста из callback_data
    const ageValue = selection.replace('age_', '');
    
    // Находим соответствующий возраст
    const allAges = [...AGE_GROUPS.under_1, ...AGE_GROUPS.over_1];
    const selectedAge = allAges.find(age => age.value === ageValue);
    
    if (!selectedAge) {
      await testBotHelpAPI.sendMessage(this.chatId, 'Пожалуйста, выберите один из предложенных вариантов');
      return;
    }

    this.userData.exactAge = selectedAge.value;
    this.userData.timestamp = new Date().toISOString();
    
    console.log(`🎯 Точный возраст выбран: ${selectedAge.label}`);

    // Сохраняем все данные
    await testBotHelpAPI.setUserVariables(this.userId, {
      exact_age: this.userData.exactAge,
      exact_age_label: selectedAge.label,
      flow_completed: true,
      flow_completed_at: this.userData.timestamp
    });

    // Завершаем поток
    await this.completeFlow();
    this.currentState = FlowState.COMPLETED;
  }

  // Завершение потока
  private async completeFlow(): Promise<void> {
    const completionMessage = `
✅ **Диагностика настроена!**

👤 **Родитель:** ${this.userData.parentName}
👶 **Возраст ребенка:** ${this.userData.childAge === 'under_1' ? 'до 1 года' : 'более 1 года'}
📅 **Точный возраст:** ${this.getAgeLabel(this.userData.exactAge!)}

🎯 Теперь мы можем начать диагностику развития вашего ребенка по методике ВОЗ.

Готовы продолжить?
    `;

    await testBotHelpAPI.sendMessage(this.chatId, completionMessage, {
      keyboard: {
        type: 'inline',
        buttons: [
          [
            { text: '🚀 Начать диагностику', callback_data: 'start_development_test' },
            { text: '📋 Посмотреть данные', callback_data: 'view_data' }
          ]
        ]
      }
    });

    console.log('🎉 Поток диагностики завершен успешно!');
    console.log('📊 Собранные данные:', this.userData);
  }

  // Получение текстового описания возраста
  private getAgeLabel(ageValue: string): string {
    const allAges = [...AGE_GROUPS.under_1, ...AGE_GROUPS.over_1];
    const age = allAges.find(a => a.value === ageValue);
    return age ? age.label : ageValue;
  }

  // Получение текущего состояния
  getCurrentState(): FlowState {
    return this.currentState;
  }

  // Получение собранных данных
  getUserData(): Partial<ChildDevelopmentData> {
    return { ...this.userData };
  }
}

// Функции для тестирования потока
export async function testChildDevelopmentFlow(): Promise<void> {
  console.log('🧪 Тестирование потока диагностики развития ребенка\n');
  
  const chatId = MOCK_DATA.testChatId;
  const userId = MOCK_DATA.testUserId;
  
  // Создаем экземпляр потока
  const flow = new ChildDevelopmentFlow(chatId, userId);
  
  // Запускаем поток
  await flow.startFlow();
  
  console.log('\n📝 Симуляция ответов пользователя...\n');
  
  // Симулируем ответы пользователя
  await flow.handleUserResponse('Анна');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза для реалистичности
  
  await flow.handleUserResponse('', 'age_under_1');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await flow.handleUserResponse('', 'age_6_to_7_months');
  
  console.log('\n✅ Тестирование потока завершено!');
  console.log('📊 Финальные данные:', flow.getUserData());
}

// Функция для обработки входящих сообщений в реальном боте
export async function handleChildDevelopmentMessage(
  chatId: string, 
  userId: string, 
  message: string, 
  callbackData?: string
): Promise<void> {
  // Получаем текущее состояние пользователя
  const userVars = await testBotHelpAPI.getUserVariables(userId);
  const currentState = userVars?.flow_state || FlowState.WELCOME;
  
  // Если это начало потока
  if (callbackData === 'start_diagnosis' || currentState === FlowState.WELCOME) {
    const flow = new ChildDevelopmentFlow(chatId, userId);
    await flow.startFlow();
    return;
  }
  
  // Если поток уже начат, продолжаем его
  if (currentState !== FlowState.WELCOME) {
    const flow = new ChildDevelopmentFlow(chatId, userId);
    await flow.handleUserResponse(message, callbackData);
  }
}

export default {
  ChildDevelopmentFlow,
  testChildDevelopmentFlow,
  handleChildDevelopmentMessage,
  FlowState,
  AGE_GROUPS
};


