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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is missing in production!');
    }
    console.warn('⚠️ DATABASE_URL is not set; Prisma will require it for DB operations.');
  }

  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Функция для проверки подключения к БД
export async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    return { connected: true };
  } catch (error: any) {
    console.error('❌ Database connection error:', error);
    return {
      connected: false,
      error: error.message || 'Unknown database error',
    };
  }
}
