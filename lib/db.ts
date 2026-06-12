// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)
// Использует @prisma/adapter-neon — HTTP fetch транспорт, хорошо подходит для serverless.

import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import { piiEncryptionExtension } from './crypto/prisma-pii-extension';

// HTTP fetch транспорт через poolQueryViaFetch=true — без WebSocket-пула,
// проще и стабильнее в serverless-функциях Vercel (короткоживущие инстансы).
neonConfig.poolQueryViaFetch = true;

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const log: Prisma.LogLevel[] = process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'];
  // .$extends(piiEncryptionExtension) — прозрачное шифрование чувствительных ПДн.
  // Возвращаем как PrismaClient: расширение сохраняет все делегаты моделей,
  // а query-хуки навешаны на реальный инстанс (каст влияет только на типы).
  if (isLocalDatabaseUrl(url)) {
    return new PrismaClient({ log }).$extends(piiEncryptionExtension) as unknown as PrismaClient;
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
    log,
  }).$extends(piiEncryptionExtension) as unknown as PrismaClient;
}

// Стандартный global singleton: переиспользуем один PrismaClient между запросами
// и через HMR в dev. На Vercel serverless инстанс живёт между инвокациями — это
// снижает число подключений к БД и стоимость холодной инициализации клиента.
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const getPrisma = (): PrismaClient => (globalForPrisma.__prisma ??= createPrismaClient());

// Обратная совместимость — proxy который инициализируется при первом обращении
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});

// Функция для проверки подключения к БД
// Не вызываем $connect() — с driver adapters соединение устанавливается лениво при первом запросе
export async function checkDatabaseConnection() {
  try {
    // Выполняем простой запрос вместо $connect(), чтобы не триггерить бинарный движок
    await (getPrisma() as any).$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (error: any) {
    console.error('❌ Database connection error:', error);
    return {
      connected: false,
      error: error.message || 'Unknown database error',
    };
  }
}
