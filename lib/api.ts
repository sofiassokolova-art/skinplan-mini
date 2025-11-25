// lib/api.ts
// API клиент для работы с бэкендом

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

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

  // Добавляем initData в заголовки для идентификации пользователя
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Авторизация (теперь просто создает/обновляет пользователя, не возвращает токен)
  async authTelegram(initData: string) {
    // Просто валидируем и создаем пользователя через обычный запрос
    // Токен больше не нужен, используем initData напрямую
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
