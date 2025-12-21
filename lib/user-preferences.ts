// lib/user-preferences.ts
// Helper функции для работы с пользовательскими настройками
// Заменяют использование localStorage

import { api } from './api';

// Кэш для preferences (чтобы не делать лишние запросы)
let preferencesCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5000; // 5 секунд кэш

// Получаем preferences с кэшированием
export async function getUserPreferences() {
  // Проверяем кэш
  if (preferencesCache && Date.now() - preferencesCache.timestamp < CACHE_TTL) {
    return preferencesCache.data;
  }

  try {
    const prefs = await api.getUserPreferences();
    preferencesCache = {
      data: prefs,
      timestamp: Date.now(),
    };
    return prefs;
  } catch (error) {
    // Если ошибка - возвращаем значения по умолчанию
    console.warn('Failed to get user preferences, using defaults:', error);
    return {
      isRetakingQuiz: false,
      fullRetakeFromHome: false,
      paymentRetakingCompleted: false,
      paymentFullRetakeCompleted: false,
      hasPlanProgress: false,
      routineProducts: null,
      planFeedbackSent: false,
      serviceFeedbackSent: false,
      lastPlanFeedbackDate: null,
      lastServiceFeedbackDate: null,
      extra: null,
    };
  }
}

// Обновляем preferences
export async function updateUserPreferences(updates: Partial<{
  isRetakingQuiz: boolean;
  fullRetakeFromHome: boolean;
  paymentRetakingCompleted: boolean;
  paymentFullRetakeCompleted: boolean;
  hasPlanProgress: boolean;
  routineProducts: any;
  planFeedbackSent: boolean;
  serviceFeedbackSent: boolean;
  lastPlanFeedbackDate: string | null;
  lastServiceFeedbackDate: string | null;
  extra: any;
}>) {
  try {
    await api.updateUserPreferences(updates);
    // Инвалидируем кэш
    preferencesCache = null;
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    throw error;
  }
}

// Удаляем конкретный флаг
export async function removeUserPreference(key: string) {
  try {
    await api.removeUserPreference(key);
    // Инвалидируем кэш
    preferencesCache = null;
  } catch (error) {
    console.error('Failed to remove user preference:', error);
    throw error;
  }
}

// Helper функции для конкретных флагов (для удобства)

export async function getIsRetakingQuiz(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.isRetakingQuiz;
}

export async function setIsRetakingQuiz(value: boolean) {
  await updateUserPreferences({ isRetakingQuiz: value });
}

export async function getFullRetakeFromHome(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.fullRetakeFromHome;
}

export async function setFullRetakeFromHome(value: boolean) {
  await updateUserPreferences({ fullRetakeFromHome: value });
}

export async function getHasPlanProgress(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.hasPlanProgress;
}

export async function setHasPlanProgress(value: boolean) {
  await updateUserPreferences({ hasPlanProgress: value });
}

export async function getPaymentRetakingCompleted(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.paymentRetakingCompleted;
}

export async function setPaymentRetakingCompleted(value: boolean) {
  await updateUserPreferences({ paymentRetakingCompleted: value });
}

export async function getPaymentFullRetakeCompleted(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.paymentFullRetakeCompleted;
}

export async function setPaymentFullRetakeCompleted(value: boolean) {
  await updateUserPreferences({ paymentFullRetakeCompleted: value });
}

export async function getRoutineProducts(): Promise<any> {
  const prefs = await getUserPreferences();
  return prefs.routineProducts;
}

export async function setRoutineProducts(value: any) {
  await updateUserPreferences({ routineProducts: value });
}

export async function getPlanFeedbackSent(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.planFeedbackSent;
}

export async function setPlanFeedbackSent(value: boolean) {
  await updateUserPreferences({ planFeedbackSent: value });
}

export async function getServiceFeedbackSent(): Promise<boolean> {
  const prefs = await getUserPreferences();
  return prefs.serviceFeedbackSent;
}

export async function setServiceFeedbackSent(value: boolean) {
  await updateUserPreferences({ serviceFeedbackSent: value });
}

export async function getLastPlanFeedbackDate(): Promise<string | null> {
  const prefs = await getUserPreferences();
  return prefs.lastPlanFeedbackDate;
}

export async function setLastPlanFeedbackDate(value: string | null) {
  await updateUserPreferences({ lastPlanFeedbackDate: value });
}

export async function getLastServiceFeedbackDate(): Promise<string | null> {
  const prefs = await getUserPreferences();
  return prefs.lastServiceFeedbackDate;
}

export async function setLastServiceFeedbackDate(value: string | null) {
  await updateUserPreferences({ lastServiceFeedbackDate: value });
}

// Инвалидируем кэш (для принудительного обновления)
export function invalidatePreferencesCache() {
  preferencesCache = null;
}

