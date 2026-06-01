'use client';

function readTelegramIdFromInitData(initData: string): string | null {
  if (!initData) return null;

  try {
    const rawUser = new URLSearchParams(initData).get('user');
    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as { id?: unknown };
    return user.id === undefined || user.id === null ? null : String(user.id);
  } catch {
    return null;
  }
}

export function getClientUserScope(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sdkUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (sdkUserId !== undefined && sdkUserId !== null) {
      return `telegram:${String(sdkUserId)}`;
    }

    const sdkInitData = window.Telegram?.WebApp?.initData || '';
    const storedInitData = sessionStorage.getItem('tg_init_data') || '';
    const telegramId =
      readTelegramIdFromInitData(sdkInitData) ||
      readTelegramIdFromInitData(storedInitData);

    return telegramId ? `telegram:${telegramId}` : null;
  } catch {
    return null;
  }
}
