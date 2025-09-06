export const tg = typeof window !== "undefined" && (window as any).Telegram ? (window as any).Telegram.WebApp : null;

export function sendToTG(payload: unknown): { ok: boolean; reason?: string } {
  try {
    if (!tg) return { ok: false, reason: "tg-not-available" };
    tg.sendData(JSON.stringify(payload));
    return { ok: true };
  } catch (e:any) {
    console.error(e);
    return { ok: false, reason: e?.message || "send-failed" };
  }
}

