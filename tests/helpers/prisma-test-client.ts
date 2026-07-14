import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { piiEncryptionExtension } from '@/lib/crypto/prisma-pii-extension';

const FALLBACK_DATABASE_URL = 'postgresql://test:test@localhost:5432/skinplan_test';

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function getSchema(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get('schema') ?? undefined;
  } catch {
    return undefined;
  }
}

export function createPrismaTestClient(databaseUrl = process.env.DATABASE_URL) {
  const connectionString = databaseUrl ?? FALLBACK_DATABASE_URL;
  // Всегда pg TCP (:5432), а не Neon HTTP fetch: с локальной сети fetch-транспорт
  // флаки и не умеет interactive transactions (P2028). Pooler Neon принимает TCP.
  const adapter = new PrismaPg({ connectionString }, { schema: getSchema(connectionString) });

  return new PrismaClient({
    adapter,
    log: ['error'],
  });
}

/**
 * Подменяет app-клиент из @/lib/db (Neon HTTP fetch) на pg TCP для локальных
 * DB-прогонов против удалённого Neon: getPrisma() в lib/db переиспользует
 * globalThis.__prisma (??=), поэтому инжект до первого запроса достаточен.
 * Зеркалит lib/db: тот же piiEncryptionExtension, чтобы поведение роутов не менялось.
 * Без DATABASE_URL или с localhost-БД — no-op (lib/db сам справится).
 */
export function injectAppPrismaOverTcp(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl || isLocalDatabaseUrl(databaseUrl)) return;
  const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };
  if (globalForPrisma.__prisma) return;
  globalForPrisma.__prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: ['error'],
  }).$extends(piiEncryptionExtension) as unknown as PrismaClient;
}

export async function isPrismaTestDatabaseAvailable(prisma: PrismaClient): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  const code = typeof lastError === 'object' && lastError !== null && 'code' in lastError
    ? String((lastError as { code?: unknown }).code)
    : 'unknown';
  console.warn(`⚠️ Test database unavailable (${code}), skipping database integration tests`);
  return false;
}
