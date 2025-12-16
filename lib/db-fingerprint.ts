// lib/db-fingerprint.ts
// Утилита для логирования "отпечатка" БД подключения
// Помогает диагностировать проблемы с разными БД/схемами между роутами

import { prisma } from './db';
import { logger } from './logger';

export async function logDbFingerprint(tag: string) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ db: string; schema: string; user: string; host: string; port: number }>
    >`
      select
        current_database() as db,
        current_schema() as schema,
        current_user as "user",
        inet_server_addr()::text as host,
        inet_server_port() as port
    `;
    
    const fingerprint = rows[0];
    
    // Логируем с высоким приоритетом (warn), чтобы было видно в логах
    // Это критично для диагностики проблемы "разные БД"
    const databaseUrl = process.env.DATABASE_URL || '';
    const urlParts = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):?(\d+)?\/([^?]+)/);
    
    logger.warn('DB_FINGERPRINT', {
      tag,
      // Отпечаток БД подключения (должен быть одинаковым во всех роутах)
      fingerprint: {
        db: fingerprint.db,
        schema: fingerprint.schema,
        user: fingerprint.user,
        host: fingerprint.host,
        port: fingerprint.port,
      },
      // Информация о DATABASE_URL (для сравнения между роутами)
      databaseUrlInfo: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        urlHost: urlParts ? urlParts[3] : 'unknown',
        urlPort: urlParts ? urlParts[4] : 'unknown',
        urlDb: urlParts ? urlParts[5] : 'unknown',
        urlPrefix: databaseUrl.substring(0, 30) + '...',
      },
      // Проверка конфликтующих переменных
      conflictingVars: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
        hasNeonDatabaseUrl: !!process.env.NEON_DATABASE_URL,
      },
    });
    
    return fingerprint;
  } catch (error: any) {
    logger.error('Failed to get DB fingerprint', error, { tag });
    return null;
  }
}
