// scripts/lib/prisma.ts
// Общий PrismaClient для CLI-скриптов (npx tsx scripts/*.ts).
// Схема использует engineType="client" + queryCompiler — Prisma требует driver
// adapter всегда, поэтому голый `new PrismaClient()` падает с ошибкой P2038.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { neonConfig } from '@neondatabase/serverless';

// HTTP fetch транспорт — как в lib/db.ts, без WebSocket-пула.
neonConfig.poolQueryViaFetch = true;

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function createScriptPrisma(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Neon serverless driver не умеет ходить в обычный Postgres — для локальной
  // БД используем adapter-pg.
  const adapter = isLocalDatabaseUrl(connectionString)
    ? new PrismaPg({ connectionString })
    : new PrismaNeon({ connectionString });

  return new PrismaClient({ adapter });
}
