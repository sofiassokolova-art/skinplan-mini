// lib/db-fingerprint.ts
// Утилита для логирования "отпечатка" БД подключения
// Помогает диагностировать проблемы с разными БД/схемами между роутами
// SERVER ONLY: Этот файл используется только в API routes

'use server';

import { prisma } from '@/lib/db';
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
    
    // Парсим все env переменные для сравнения
    const envVars = {
      DATABASE_URL: process.env.DATABASE_URL ? {
        host: urlParts ? urlParts[3] : 'unknown',
        port: urlParts ? urlParts[4] : 'unknown',
        db: urlParts ? urlParts[5] : 'unknown',
        user: urlParts ? urlParts[1] : 'unknown',
        prefix: databaseUrl.substring(0, 50) + '...',
      } : null,
      POSTGRES_URL: process.env.POSTGRES_URL ? {
        exists: true,
        prefix: process.env.POSTGRES_URL.substring(0, 50) + '...',
      } : null,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? {
        exists: true,
        prefix: process.env.POSTGRES_PRISMA_URL.substring(0, 50) + '...',
      } : null,
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL ? {
        exists: true,
        prefix: process.env.NEON_DATABASE_URL.substring(0, 50) + '...',
      } : null,
    };
    
    // Используем console.warn напрямую для гарантированного вывода в Vercel logs
    console.warn('🔍 DB_FINGERPRINT', JSON.stringify({
      tag,
      // Отпечаток БД подключения (должен быть одинаковым во всех роутах)
      fingerprint: {
        db: fingerprint.db,
        schema: fingerprint.schema,
        user: fingerprint.user,
        host: fingerprint.host,
        port: fingerprint.port,
      },
      // Информация о env переменных (для сравнения между роутами)
      envVars,
      // Проверка конфликтующих переменных
      conflictingVars: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
        hasNeonDatabaseUrl: !!process.env.NEON_DATABASE_URL,
      },
    }, null, 2));
    
    // Также логируем через logger для структурированных логов
    logger.warn('DB_FINGERPRINT', {
      tag,
      fingerprint: {
        db: fingerprint.db,
        schema: fingerprint.schema,
        user: fingerprint.user,
        host: fingerprint.host,
        port: fingerprint.port,
      },
      envVars: {
        DATABASE_URL: process.env.DATABASE_URL ? {
          host: urlParts ? urlParts[3] : 'unknown',
          port: urlParts ? urlParts[4] : 'unknown',
          db: urlParts ? urlParts[5] : 'unknown',
        } : null,
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
