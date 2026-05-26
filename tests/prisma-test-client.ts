import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

function canUseNeonAdapter(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1';
  } catch {
    return false;
  }
}

export const hasTestDatabase = canUseNeonAdapter(process.env.DATABASE_URL);

export function createPrismaTestClient() {
  return new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: process.env.DATABASE_URL || 'postgresql://unused.invalid/db',
    }),
  });
}
