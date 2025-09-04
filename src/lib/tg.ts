// src/lib/tg.ts
// Хелпер для работы с Telegram WebApp API

export const tg: (null | any) =
  typeof window !== "undefined" && (window as any).Telegram
    ? (window as any).Telegram.WebApp
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
  } catch (e: any) {
    return { ok: false, reason: e?.message || "unknown" };
  }
}
