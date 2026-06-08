// lib/quiz/handlers/handleGetPlan.ts
// Обработчик для кнопки "Получить план ухода" на info screens
// Вынесен из renderInfoScreen для улучшения читаемости

import { clientLogger } from '@/lib/client-logger';
import { resolveTelegramInitData } from '@/lib/telegram-client';

export interface HandleGetPlanParams {
  // State
  isSubmitting: boolean;
  questionnaire: any | null;
  isDev: boolean;
  
  // Refs
  isSubmittingRef: React.MutableRefObject<boolean>;
  
  // Setters
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Functions
  submitAnswers: () => Promise<void>;
}

export async function handleGetPlan(params: HandleGetPlanParams): Promise<void> {
  const {
    isSubmitting,
    questionnaire,
    isDev,
    isSubmittingRef,
    setIsSubmitting,
    setError,
    setLoading,
    submitAnswers,
  } = params;

  clientLogger.log('🔘 handleGetPlan вызван');
  
  // ИСПРАВЛЕНО: Проверяем isSubmittingRef.current как источник истины
  // Это предотвращает множественные вызовы submitAnswers
  if (isSubmittingRef.current || isSubmitting) {
    clientLogger.warn('⚠️ Уже отправляется', {
      isSubmittingRef: isSubmittingRef.current,
      isSubmitting,
    });
    return;
  }
  
  if (!questionnaire) {
    console.error('❌ Анкета не загружена');
    setError('Анкета не загружена. Пожалуйста, обновите страницу.');
    return;
  }
  
  // Проверяем наличие initData перед отправкой.
  // ВАЖНО: берём initData через resolveTelegramInitData (SDK → URL hash → sessionStorage),
  // а НЕ через window.Telegram.WebApp напрямую. На части устройств/сетей скрипт
  // telegram-web-app.js не загружается, window.Telegram.WebApp не создаётся, но Telegram
  // всё равно передал валидный initData в URL hash — в этом случае сабмит должен работать.
  const initData = resolveTelegramInitData();
  const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;

  clientLogger.log('📱 Проверка Telegram перед отправкой:', {
    hasWindow: typeof window !== 'undefined',
    hasTelegram: isInTelegram,
    hasInitData: !!initData,
    initDataLength: initData?.length || 0,
  });

  if (!initData && !isDev) {
    console.error('❌ initData недоступен (ни SDK, ни URL hash, ни sessionStorage)');
    setError('Не удалось получить данные авторизации Telegram. Закройте и откройте приложение заново.');
    return;
  }
  
  clientLogger.log('🚀 Запуск submitAnswers...');
  // НЕ устанавливаем setIsSubmitting(true) здесь — submitAnswers сам ставит finalizing
  // и один лоадер QuizFinalizingLoader. Иначе был бы лишний рендер с "Отправка..." на кнопке.
  
  try {
    await submitAnswers();
  } catch (err: any) {
    console.error('❌ Ошибка в handleGetPlan:', err);
    console.error('   Error message:', err?.message);
    console.error('   Error stack:', err?.stack);
    
    let errorMessage = 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.';
    
    if (err?.message?.includes('Unauthorized') || 
        err?.message?.includes('401') || 
        err?.message?.includes('initData') ||
        err?.message?.includes('авторизации')) {
      errorMessage = 'Ошибка авторизации. Пожалуйста, обновите страницу и убедитесь, что приложение открыто через Telegram Mini App.';
    } else if (err?.message) {
      errorMessage = err.message;
    }
    
    // Убеждаемся, что errorMessage всегда строка
    const safeErrorMessage = String(errorMessage || 'Ошибка отправки ответов. Попробуйте еще раз.');
    setError(safeErrorMessage);
    // ИСПРАВЛЕНО: Сбрасываем состояние и ref при ошибке
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  }
}

