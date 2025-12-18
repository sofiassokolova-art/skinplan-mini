// app/api/health/route.ts
// Health check endpoint для мониторинга состояния приложения

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCachedPlan } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; duration?: number }> = {};
  
  // Проверка подключения к БД
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'ok',
      duration: Date.now() - dbStart,
    };
  } catch (error: any) {
    logger.error('Health check: Database connection failed', error);
    checks.database = {
      status: 'error',
      message: error?.message || 'Database connection failed',
    };
  }

  // Smoke-check схемы БД: критичные колонки/таблицы должны существовать,
  // иначе деплой может включить код, который ждёт колонки, которых нет.
  if (checks.database?.status === 'ok') {
    try {
      const schemaStart = Date.now();
      const required = [
        { table: 'users', column: 'current_profile_id' },
        { table: 'skin_profiles', column: 'id' },
        { table: 'plan28', column: 'id' },
      ];

      const results = await Promise.all(
        required.map(async (item) => {
          const rows = await prisma.$queryRaw<
            Array<{ exists: boolean }>
          >`SELECT EXISTS(
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = ${item.table}
                AND column_name = ${item.column}
            ) as "exists"`;
          return { ...item, exists: rows?.[0]?.exists === true };
        })
      );

      const missing = results.filter((r) => !r.exists);
      checks.schema = {
        status: missing.length === 0 ? 'ok' : 'error',
        duration: Date.now() - schemaStart,
        message:
          missing.length === 0
            ? 'Schema looks consistent'
            : `Missing columns: ${missing.map((m) => `${m.table}.${m.column}`).join(', ')}`,
      };
    } catch (error: any) {
      logger.error('Health check: Schema validation failed', error);
      checks.schema = {
        status: 'error',
        message: error?.message || 'Schema validation failed',
      };
    }
  }

  // Проверка кэша (KV)
  try {
    const cacheStart = Date.now();
    // Пробуем выполнить простую операцию с кэшем
    const testResult = await getCachedPlan('health-check-test', 0);
    checks.cache = {
      status: 'ok',
      duration: Date.now() - cacheStart,
      message: testResult === null ? 'Cache available (test key not found is expected)' : 'Cache available',
    };
  } catch (error: any) {
    // Кэш недоступен - это не критично, но стоит залогировать
    checks.cache = {
      status: 'error',
      message: error?.message || 'Cache not available',
    };
  }

  // Проверка переменных окружения
  const requiredEnvVars = ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN'];
  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missingEnvVars.length > 0) {
    checks.environment = {
      status: 'error',
      message: `Missing env vars: ${missingEnvVars.join(', ')}`,
    };
  } else {
    checks.environment = {
      status: 'ok',
    };
  }

  const totalDuration = Date.now() - startTime;
  const allOk = Object.values(checks).every(check => check.status === 'ok');
  const status = allOk ? 200 : 503;

  return new Response(
    JSON.stringify({
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      checks,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
