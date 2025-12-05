// tests/setup.ts
// Настройка тестового окружения

import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Подключение к БД перед всеми тестами
  await prisma.$connect();
});

afterAll(async () => {
  // Отключение от БД после всех тестов
  await prisma.$disconnect();
});

