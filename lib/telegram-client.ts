// lib/telegram-client.ts
// Клиент для работы с Telegram WebApp API (клиентская часть)

'use client';

import { useCallback, useEffect, useState } from 'react';

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

/** На мобильном Telegram часто передаёт initData в URL hash (tgWebAppData), если скрипт с telegram.org не успел загрузиться */
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
 * Хук для работы с Telegram WebApp
 * После загрузки скрипта (strategy afterInteractive) Telegram может появиться с задержкой — подписываемся и обновляем state
 */
export function useTelegram() {
  const [initDataFromScript, setInitDataFromScript] = useState<string | null>(null);

  // 1) Сразу пробуем взять initData из URL hash (на мобильном Telegram передаёт tgWebAppData туда)
  // 2) Когда скрипт telegram-web-app.js загрузится, подхватим window.Telegram
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromHash = getInitDataFromHash();
    if (fromHash) setInitDataFromScript(fromHash);

    const read = () => {
      try {
        const data = window.Telegram?.WebApp?.initData || '';
        if (data) setInitDataFromScript(data);
      } catch (_) {}
    };
    read();
    const t = setInterval(read, 300);
    const done = () => {
      clearInterval(t);
      read();
    };
    const onReady = () => {
      done();
      window.removeEventListener('telegram-webapp-ready', onReady);
    };
    window.addEventListener('telegram-webapp-ready', onReady);
    const timeout = setTimeout(done, 8000);
    return () => {
      clearInterval(t);
      clearTimeout(timeout);
      window.removeEventListener('telegram-webapp-ready', onReady);
    };
  }, []);

  let initData = '';
  let user: TelegramWebApp['initDataUnsafe']['user'] = undefined;

  try {
    if (typeof window !== 'undefined') {
      initData = initDataFromScript ?? window.Telegram?.WebApp?.initData ?? getInitDataFromHash() ?? '';
      user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    }
  } catch (err) {
    console.warn('⚠️ Error accessing Telegram WebApp:', err);
  }

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
    initData,
    user,
    initialize,
    sendData,
    isAvailable: !!tg,
  };
}
