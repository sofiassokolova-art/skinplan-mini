// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const baseOptions: ConstructorParameters<typeof PrismaClient>[0] = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };

  // КРИТИЧНО: Используем ТОЛЬКО DATABASE_URL как единственный источник правды
  // Не используем POSTGRES_URL, POSTGRES_PRISMA_URL или другие переменные
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is missing in production!');
    }
    console.warn('⚠️ DATABASE_URL is not set; Prisma will require it for DB operations.');
  } else {
    baseOptions.datasources = {
      db: { url },
    };
  }

  return new PrismaClient(baseOptions);
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
      error: error.message || 'Unknown database error' 
    };
  }
}
