// lib/telegram-client.ts
// Клиент для работы с Telegram WebApp API (клиентская часть)

'use client';

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
  typeof window !== 'undefined' && window.Telegram
    ? window.Telegram.WebApp
    : null;

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
 */
export function useTelegram() {
  const initData = tg?.initData || '';
  const user = tg?.initDataUnsafe?.user;

  const initialize = () => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  };

  const sendData = (data: unknown) => {
    return sendToTG(data);
  };

  return {
    tg,
    initData,
    user,
    initialize,
    sendData,
    isAvailable: !!tg,
  };
}
