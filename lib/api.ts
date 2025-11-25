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
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
  // Авторизация
  async authTelegram(initData: string) {
    const response = await request<{ token: string; user: any }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
    
    if (typeof window !== 'undefined' && response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
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
