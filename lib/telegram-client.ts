// lib/telegram-client.ts
// Клиент для работы с Telegram WebApp API (клиентская часть)

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  showPopup: (params: { title: string; message: string; buttons?: Array<{ type: string }> }) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export const tg: TelegramWebApp | null =
  typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

/** Извлекает initData из URL hash (#tgWebAppData=...) — мобильный Telegram передаёт данные так, если скрипт ещё не загрузился */
function getInitDataFromHash(): string {
  if (typeof window === 'undefined') return '';
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return '';
    const params = new URLSearchParams(hash);
    const raw = params.get('tgWebAppData');
    return raw ? decodeURIComponent(raw) : '';
  } catch {
    return '';
  }
}

/** Извлекает auth_date из initData строки */
function getAuthDate(initData: string): number {
  if (!initData) return 0;
  const match = initData.match(/auth_date=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

const INIT_DATA_MAX_AGE_SEC = 82800; // 23 часа (с запасом от серверных 24ч)

export function sendToTG(payload: unknown): { ok: boolean; reason?: string } {
  try {
    if (!tg) return { ok: false, reason: 'tg-not-available' };
    const json = JSON.stringify(payload);
    tg.sendData(json);
    tg.showPopup?.({
      title: 'Отправлено',
      message: 'Данные переданы в Telegram',
      buttons: [{ type: 'close' }],
    });
    return { ok: true };
  } catch (e) {
    const error = e as Error;
    return { ok: false, reason: error?.message || 'unknown' };
  }
}

/**
 * Хук для работы с Telegram WebApp.
 *
 * Приоритет источников initData:
 * 1. window.Telegram.WebApp.initData — основной (после загрузки скрипта)
 * 2. URL hash (#tgWebAppData=...) — fallback на мобильном до загрузки скрипта
 *
 * Оптимизировано: вместо polling каждые 300мс используем событие telegram-webapp-ready
 * с единственным fallback setTimeout.
 */
export function useTelegram() {
  const [resolvedInitData, setResolvedInitData] = useState<string>('');
  const [expired, setExpired] = useState(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const resolve = () => {
      // Приоритет: скрипт Telegram > hash
      const fromScript = window.Telegram?.WebApp?.initData || '';
      const fromHash = getInitDataFromHash();
      const best = fromScript || fromHash;
      if (best) {
        setResolvedInitData(best);
        setExpired(false);

        // Планируем проверку истечения
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        const authDate = getAuthDate(best);
        if (authDate > 0) {
          const nowSec = Math.floor(Date.now() / 1000);
          const remainingSec = INIT_DATA_MAX_AGE_SEC - (nowSec - authDate);
          if (remainingSec <= 0) {
            setExpired(true);
          } else {
            expiryTimerRef.current = setTimeout(() => setExpired(true), remainingSec * 1000);
          }
        }
      }
    };

    // Сразу пробуем
    resolve();

    // Слушаем событие загрузки скрипта
    const onReady = () => {
      resolve();
      window.removeEventListener('telegram-webapp-ready', onReady);
    };
    window.addEventListener('telegram-webapp-ready', onReady);

    // Один fallback-таймер (3с) вместо бесконечного polling
    const fallback = setTimeout(resolve, 3000);

    return () => {
      window.removeEventListener('telegram-webapp-ready', onReady);
      clearTimeout(fallback);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, []);

  let user: TelegramWebApp['initDataUnsafe']['user'] = undefined;
  try {
    if (typeof window !== 'undefined') {
      user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    }
  } catch (_) {}

  const initialize = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }
    } catch (err) {
      console.warn('⚠️ Error initializing Telegram WebApp:', err);
    }
  }, []);

  const sendData = useCallback((data: unknown) => {
    return sendToTG(data);
  }, []);

  return {
    tg,
    initData: resolvedInitData,
    user,
    initialize,
    sendData,
    isAvailable: !!tg,
    /** true если initData истёк (>23ч) — покажите пользователю кнопку «Обновить» */
    expired,
  };
}
