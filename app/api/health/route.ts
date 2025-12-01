// app/api/health/route.ts
// Health check endpoint для мониторинга

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
    };
    redis?: {
      status: 'ok' | 'error' | 'not_configured';
      responseTime?: number;
      error?: string;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: { status: 'error' },
  };

  // Проверка базы данных
  try {
    const dbStartTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStartTime;
    checks.database = {
      status: 'ok',
      responseTime: dbResponseTime,
    };
  } catch (error: any) {
    checks.database = {
      status: 'error',
      error: error?.message || 'Database connection failed',
    };
  }

  // Проверка Redis (опционально)
  try {
    const redis = getRedis();
    if (redis && process.env.UPSTASH_REDIS_REST_URL) {
      const redisStartTime = Date.now();
      // Простая проверка - пробуем выполнить команду
      await redis.ping();
      const redisResponseTime = Date.now() - redisStartTime;
      checks.redis = {
        status: 'ok',
        responseTime: redisResponseTime,
      };
    } else {
      checks.redis = {
        status: 'not_configured',
      };
    }
  } catch (error: any) {
    checks.redis = {
      status: 'error',
      error: error?.message || 'Redis connection failed',
    };
  }

  // Определяем общий статус
  const hasCriticalError = checks.database.status === 'error';
  const hasDegradedService = checks.redis?.status === 'error';

  const status: HealthStatus['status'] = hasCriticalError
    ? 'unhealthy'
    : hasDegradedService
    ? 'degraded'
    : 'healthy';

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    checks,
  };

  const httpStatus = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200;

  return NextResponse.json(healthStatus, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

