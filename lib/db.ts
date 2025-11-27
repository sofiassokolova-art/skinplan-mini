// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

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
