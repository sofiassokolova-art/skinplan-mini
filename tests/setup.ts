// tests/setup.ts
// Настройка тестового окружения

import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

beforeAll(async () => {
  // Подключение к БД перед всеми тестами (если DATABASE_URL задан)
  if (!process.env.DATABASE_URL) {
    return;
  }
  prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });
  await prisma.$connect();
});

afterAll(async () => {
  // Отключение от БД после всех тестов
  await prisma?.$disconnect();
});

