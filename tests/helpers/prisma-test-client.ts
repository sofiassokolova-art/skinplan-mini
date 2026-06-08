import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

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
  const adapter = isLocalDatabaseUrl(connectionString)
    ? new PrismaPg({ connectionString }, { schema: getSchema(connectionString) })
    : new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: ['error'],
  });
}
