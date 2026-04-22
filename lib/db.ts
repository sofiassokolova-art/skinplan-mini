// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)
// Использует @prisma/adapter-neon для совместимости с Cloudflare Workers/Pages

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';

// В Cloudflare Workers используем встроенный WebSocket вместо ws-пакета
// В Node.js среде (dev/scripts) neonConfig.webSocketConstructor не нужен
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  // PrismaNeon требует Pool-инстанс из @neondatabase/serverless
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Lazy getter — инициализируем только при первом обращении во время запроса,
// когда CF Workers уже инжектил process.env из Dashboard Variables
export const getPrisma = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
};

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
