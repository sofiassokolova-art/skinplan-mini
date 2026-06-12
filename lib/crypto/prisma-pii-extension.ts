// lib/crypto/prisma-pii-extension.ts
// Прозрачное шифрование/дешифрование чувствительных полей на уровне Prisma Client.
// Единая точка: подключается в lib/db.ts, поэтому все 87 потребителей @/lib/db
// автоматически читают расшифрованные данные и пишут зашифрованные — без правок в местах вызова.
//
// Шифруемые поля:
//   - User.medicalMarkers нет; SkinProfile.medicalMarkers (Json, данные о здоровье)
//   - User.phoneNumber (String)
// ВАЖНО: phoneNumber есть и у AdminWhitelist (там @unique, ищется по where) — его НЕ шифруем.

import { Prisma } from '@prisma/client';
import { encryptString, decryptString, isEncrypted, isPiiEncryptionEnabled } from './pii';

// Модели, в дереве данных которых phoneNumber относится к пользователю и подлежит шифрованию.
// AdminWhitelist сюда не входит — его телефон остаётся в открытом виде (ищется по where).
const PHONE_ENCRYPT_MODELS = new Set(['User']);

async function encryptValueForKey(key: string, value: unknown): Promise<unknown> {
  if (value == null) return value;
  if (key === 'medicalMarkers') {
    if (isEncrypted(value)) return value; // уже зашифровано
    if (typeof value === 'object') return encryptString(JSON.stringify(value));
    if (typeof value === 'string') return encryptString(value);
    return value;
  }
  if (key === 'phoneNumber') {
    if (typeof value !== 'string' || isEncrypted(value)) return value;
    return encryptString(value);
  }
  return value;
}

async function decryptValueForKey(key: string, value: unknown): Promise<unknown> {
  if (typeof value !== 'string' || !isEncrypted(value)) return value; // legacy plaintext / не наше
  const plain = await decryptString(value);
  if (key === 'medicalMarkers') {
    try {
      return JSON.parse(plain);
    } catch {
      return plain;
    }
  }
  return plain;
}

/** Рекурсивно шифрует поля в дереве аргументов записи (data/create/update). */
async function encryptTree(node: unknown, allowPhone: boolean): Promise<void> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) await encryptTree(item, allowPhone);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'medicalMarkers') {
      obj[key] = await encryptValueForKey(key, val);
      continue;
    }
    if (key === 'phoneNumber' && allowPhone) {
      obj[key] = await encryptValueForKey(key, val);
      continue;
    }
    if (val && typeof val === 'object') await encryptTree(val, allowPhone);
  }
}

/** Рекурсивно дешифрует поля в дереве результата (passthrough для legacy plaintext). */
async function decryptTree(node: unknown): Promise<void> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) await decryptTree(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'medicalMarkers' || key === 'phoneNumber') {
      obj[key] = await decryptValueForKey(key, val);
      continue;
    }
    if (val && typeof val === 'object') await decryptTree(val);
  }
}

export const piiEncryptionExtension = Prisma.defineExtension({
  name: 'pii-encryption',
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        if (!isPiiEncryptionEnabled()) {
          return query(args);
        }
        const allowPhone = PHONE_ENCRYPT_MODELS.has(model);
        // 1. Шифруем входные данные записи (никогда не трогаем where).
        if (args && typeof args === 'object') {
          const a = args as Record<string, unknown>;
          if (a.data) await encryptTree(a.data, allowPhone);
          if (a.create) await encryptTree(a.create, allowPhone); // upsert
          if (a.update) await encryptTree(a.update, allowPhone); // upsert
        }
        // 2. Выполняем запрос.
        const result = await query(args);
        // 3. Дешифруем результат.
        await decryptTree(result);
        return result;
      },
    },
  },
});
