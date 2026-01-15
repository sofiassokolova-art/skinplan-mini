// lib/quiz/hooks/useQuizUrlSync.ts
// Хук для синхронизации URL с состоянием резюм-экрана

import { useEffect, useRef } from 'react';

interface UseQuizUrlSyncParams {
  showResumeScreen: boolean;
}

/**
 * Хук для синхронизации URL параметров с состоянием резюм-экрана
 * Предотвращает множественные вызовы history.replaceState
 */
export function useQuizUrlSync({ showResumeScreen }: UseQuizUrlSyncParams) {
  const historyUpdateInProgressRef = useRef(false);
  const lastHistoryUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНО: Throttle history updates - не чаще раза в секунду
    const now = Date.now();
    if (historyUpdateInProgressRef.current || (now - lastHistoryUpdateTimeRef.current < 1000)) {
      return; // Пропускаем, если обновление уже в процессе или было недавно
    }
    
    // Проверяем текущее значение параметра resume в URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentResume = urlParams.get('resume') === 'true';
    
    // Обновляем URL только если значение изменилось
    if (showResumeScreen && !currentResume) {
      historyUpdateInProgressRef.current = true;
      lastHistoryUpdateTimeRef.current = now;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('resume', 'true');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Игнорируем SecurityError
        console.warn('Failed to update URL with resume param:', e);
      } finally {
        historyUpdateInProgressRef.current = false;
      }
    } else if (!showResumeScreen && currentResume) {
      historyUpdateInProgressRef.current = true;
      lastHistoryUpdateTimeRef.current = now;
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('resume');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Игнорируем SecurityError
        console.warn('Failed to remove resume param from URL:', e);
      } finally {
        historyUpdateInProgressRef.current = false;
      }
    }
  }, [showResumeScreen]);
}
