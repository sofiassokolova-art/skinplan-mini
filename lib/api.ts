// lib/api.ts
// API клиент для работы с бэкендом

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Получаем initData из Telegram WebApp
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
    ? window.Telegram.WebApp.initData
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Добавляем initData в заголовки для идентификации пользователя (только если доступен)
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = error.error || `HTTP ${response.status}`;
    
    // Для 401 ошибок добавляем более информативное сообщение
    if (response.status === 401 && !initData) {
      throw new Error('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Устаревшая функция - больше не нужна, initData передается автоматически
  async authTelegram(initData: string) {
    return { success: true };
  },

  // Анкета
  async getActiveQuestionnaire() {
    return request('/questionnaire/active');
  },

  async submitAnswers(questionnaireId: number, answers: Array<{
    questionId: number;
    answerValue?: string;
    answerValues?: string[];
  }>) {
    return request('/questionnaire/answers', {
      method: 'POST',
      body: JSON.stringify({ questionnaireId, answers }),
    });
  },

  // Профиль
  async getCurrentProfile() {
    return request('/profile/current');
  },

  // Рекомендации
  async getRecommendations() {
    return request('/recommendations');
  },

  // План ухода (28 дней)
  async getPlan() {
    return request('/plan/generate');
  },

  // Прогресс анкеты
  async getQuizProgress() {
    return request('/questionnaire/progress');
  },

  async saveQuizProgress(questionnaireId: number, questionId: number, answerValue?: string, answerValues?: string[]) {
    return request('/questionnaire/progress', {
      method: 'POST',
      body: JSON.stringify({
        questionnaireId,
        questionId,
        answerValue,
        answerValues,
      }),
    });
  },
};
