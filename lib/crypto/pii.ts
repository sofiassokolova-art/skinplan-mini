// lib/crypto/pii.ts
// Шифрование чувствительных персональных данных (ст. 10 152-ФЗ: данные о здоровье).
// AES-256-GCM через Web Crypto API — работает и в Node, и в Edge runtime.
//
// Формат хранения: "enc:v1:<base64(iv[12] || ciphertext+tag)>"
// Значения без префикса считаются legacy-plaintext и при чтении возвращаются как есть
// (это делает миграцию существующих данных безопасной и идемпотентной).

const ENC_PREFIX = 'enc:v1:';
const IV_BYTES = 12;

let cachedKey: Promise<CryptoKey> | null = null;

/** Парсит ключ из env: hex (64 симв.) или base64 (44 симв.) → 32 байта. */
function parseRawKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  // hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  // base64 / base64url
  const b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error(`PII_ENCRYPTION_KEY must decode to 32 bytes, got ${bytes.length}`);
  }
  return bytes;
}

/** Включено ли шифрование (есть ли валидный ключ). */
export function isPiiEncryptionEnabled(): boolean {
  return !!process.env.PII_ENCRYPTION_KEY;
}

function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    // Fail-closed в проде: без ключа нельзя гарантировать защиту спец-категории ПДн.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY is required in production for personal data encryption');
    }
    return Promise.reject(new Error('PII_ENCRYPTION_KEY not set'));
  }
  cachedKey = crypto.subtle.importKey('raw', parseRawKey(raw) as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return cachedKey;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Похоже ли значение на наш шифртекст. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/** Шифрует строку. Если шифрование выключено (нет ключа вне прода) — возвращает исходное. */
export async function encryptString(plain: string): Promise<string> {
  if (!isPiiEncryptionEnabled()) return plain;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return ENC_PREFIX + toBase64(out);
}

/** Дешифрует строку. Значения без префикса (legacy plaintext) возвращаются как есть. */
export async function decryptString(value: string): Promise<string> {
  if (!isEncrypted(value)) return value;
  const key = await getKey();
  const raw = fromBase64(value.slice(ENC_PREFIX.length));
  const iv = raw.slice(0, IV_BYTES);
  const ct = raw.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return new TextDecoder().decode(pt);
}
