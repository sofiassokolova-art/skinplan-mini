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
  let url = process.env.DATABASE_URL;
  
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is missing in production!');
    }
    console.warn('⚠️ DATABASE_URL is not set; Prisma will require it for DB operations.');
  } else {
    // ИСПРАВЛЕНО: Добавляем параметры connection pool для предотвращения timeout
    // Если параметры уже есть в URL, не добавляем их повторно
    const urlObj = new URL(url);
    
    // Увеличиваем connection_limit до 20 (по умолчанию Prisma использует num_physical_cpus * 2 + 1)
    if (!urlObj.searchParams.has('connection_limit')) {
      urlObj.searchParams.set('connection_limit', '20');
    }
    
    // Увеличиваем pool_timeout до 20 секунд (по умолчанию 10 секунд)
    if (!urlObj.searchParams.has('pool_timeout')) {
      urlObj.searchParams.set('pool_timeout', '20');
    }
    
    // Увеличиваем connect_timeout до 15 секунд (по умолчанию 5 секунд)
    // Это особенно важно для Neon, когда compute находится в idle состоянии
    if (!urlObj.searchParams.has('connect_timeout')) {
      urlObj.searchParams.set('connect_timeout', '15');
    }
    
    url = urlObj.toString();
    
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
