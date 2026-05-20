// lib/validate-telegram-login.ts
// Валидация данных от Telegram Login Widget (Edge-compatible)

interface TelegramLoginData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function toRawBuffer(key: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (key instanceof Uint8Array) {
    return key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  }
  return key;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', toRawBuffer(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function validateTelegramLoginWidget(
  data: TelegramLoginData,
  botToken: string
): Promise<{ valid: boolean; user?: TelegramLoginData['id'] | null; error?: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400) {
      return { valid: false, error: 'Data expired' };
    }

    const dataCheckString = Object.keys(data)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${data[key as keyof TelegramLoginData]}`)
      .join('\n');

    // secretKey = HMAC-SHA256("WebAppData", botToken)
    const webAppDataKey = new TextEncoder().encode('WebAppData');
    const secretKey = await hmacSha256(webAppDataKey, botToken);
    const calculatedHash = bufToHex(await hmacSha256(new Uint8Array(secretKey), dataCheckString));

    if (calculatedHash !== data.hash) {
      return { valid: false, error: 'Invalid hash' };
    }

    return { valid: true, user: data.id };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
