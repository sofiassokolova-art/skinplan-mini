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
    logger.warn('DB_FINGERPRINT', {
      tag,
      db: fingerprint.db,
      schema: fingerprint.schema,
      user: fingerprint.user,
      host: fingerprint.host,
      port: fingerprint.port,
      // Также логируем env переменные для диагностики
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) || 'not set',
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
    });
    
    return fingerprint;
  } catch (error: any) {
    logger.error('Failed to get DB fingerprint', error, { tag });
    return null;
  }
}
