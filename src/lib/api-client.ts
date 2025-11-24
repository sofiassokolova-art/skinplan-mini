// src/lib/api-client.ts
// Клиент для работы с API

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

export interface ApiQuestionnaire {
  id: number;
  name: string;
  version: number;
  groups: Array<{
    id: number;
    title: string;
    position: number;
    questions: Array<{
      id: number;
      code: string;
      text: string;
      type: string;
      position: number;
      isRequired: boolean;
      description?: string | null;
      options: Array<{
        id: number;
        value: string;
        label: string;
        position: number;
      }>;
    }>;
  }>;
  questions: Array<{
    id: number;
    code: string;
    text: string;
    type: string;
    position: number;
    isRequired: boolean;
    description?: string | null;
    options: Array<{
      id: number;
      value: string;
      label: string;
      position: number;
    }>;
  }>;
}

export interface ApiQuestionAnswer {
  questionId: number;
  questionCode: string;
  value?: string;
  values?: string[];
}

/**
 * Загружает активную анкету из API
 */
export async function fetchQuestionnaire(): Promise<ApiQuestionnaire | null> {
  try {
    const response = await fetch(`${API_BASE}/api/questionnaire/active`);
    if (!response.ok) {
      console.warn('Failed to fetch questionnaire from API:', response.status);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Error fetching questionnaire from API:', error);
    return null;
  }
}

/**
 * Сохраняет ответы пользователя через API
 */
export async function submitAnswers(
  questionnaireId: number,
  answers: Array<{
    questionId?: number;
    questionCode?: string;
    value?: string;
    values?: string[];
  }>
): Promise<{ success: boolean; profileId?: number; error?: string }> {
  try {
    // Получаем токен из localStorage (если есть)
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      return { success: false, error: 'No auth token' };
    }
    
    // Преобразуем answers в формат, ожидаемый API
    const formattedAnswers = answers.map(answer => ({
      questionId: answer.questionId || 0, // Если нет questionId, API должен получить его по code
      answerValue: answer.value || undefined,
      answerValues: answer.values || undefined,
    }));

    const response = await fetch(`${API_BASE}/api/questionnaire/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        questionnaireId,
        answers: formattedAnswers,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: error.error || 'Failed to submit answers' };
    }

    const data = await response.json();
    return { success: true, profileId: data.profile?.id };
  } catch (error) {
    console.error('Error submitting answers to API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Авторизация через Telegram
 */
export async function authWithTelegram(initData: string): Promise<{ token?: string; user?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initData }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { error: error.error || 'Failed to authenticate' };
    }

    const data = await response.json();
    
    // Сохраняем токен
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    
    return { token: data.token, user: data.user };
  } catch (error) {
    console.error('Error authenticating with Telegram:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Проверяет, открыт ли мини-апп в Telegram
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Telegram?.WebApp;
}

/**
 * Получает initData из Telegram WebApp
 */
export function getTelegramInitData(): string | null {
  if (!isTelegramWebApp()) return null;
  try {
    return (window as any).Telegram.WebApp.initData || null;
  } catch {
    return null;
  }
}

