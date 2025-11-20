// src/lib/tg.ts
// Хелпер для работы с Telegram WebApp API

import type { TelegramWebApp } from '../types/telegram';

export const tg: TelegramWebApp | null =
  typeof window !== "undefined" && window.Telegram
    ? window.Telegram.WebApp
    : null;

export function sendToTG(payload: unknown): { ok: boolean; reason?: string } {
  try {
    if (!tg) return { ok: false, reason: "tg-not-available" };
    const json = JSON.stringify(payload);
    tg.sendData(json);
    tg.showPopup?.({
      title: "Отправлено",
      message: "Данные переданы в Telegram",
      buttons: [{ type: "close" }],
    });
    return { ok: true };
  } catch (e) {
    const error = e as Error;
    return { ok: false, reason: error?.message || "unknown" };
  }
}
