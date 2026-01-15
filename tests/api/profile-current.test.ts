// tests/api/profile-current.test.ts
// API тесты для /api/profile/current

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GET as getCurrentProfile } from '@/app/api/profile/current/route';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

const testUserId = 'test-user-api-profile-current';

describe('GET /api/profile/current', () => {
  beforeEach(async () => {
    if (!hasDatabase) return;

    // Очистка тестовых данных
    await prismaTest.skinProfile.deleteMany({
      where: { userId: testUserId },
    });
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  it('должен вернуть текущий профиль пользователя', async () => {
    if (!hasDatabase) {
      console.warn('⚠️ DATABASE_URL not set, skipping API tests');
      return;
    }

    // Создаем тестовый профиль
    const profile = await prismaTest.skinProfile.create({
      data: {
        userId: testUserId,
        version: 1,
        skinType: 'dry',
        concerns: ['moisturizing', 'anti-aging'],
        diagnoses: ['eczema'],
      },
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/profile/current', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await getCurrentProfile(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe(profile.id);
    expect(data.data.userId).toBe(testUserId);
    expect(data.data.skinType).toBe('dry');
  });

  it('должен вернуть 404 если профиль не найден', async () => {
    if (!hasDatabase) return;

    // Убеждаемся, что профиля нет
    await prismaTest.skinProfile.deleteMany({
      where: { userId: testUserId },
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/profile/current', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await getCurrentProfile(request);
    expect(response.status).toBe(404);
  });

  it('должен вернуть последнюю версию профиля', async () => {
    if (!hasDatabase) return;

    // Создаем несколько версий профиля
    await prismaTest.skinProfile.createMany({
      data: [
        {
          userId: testUserId,
          version: 1,
          skinType: 'dry',
          concerns: ['moisturizing'],
          diagnoses: [],
        },
        {
          userId: testUserId,
          version: 2,
          skinType: 'oily',
          concerns: ['acne'],
          diagnoses: [],
        },
      ],
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/profile/current', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await getCurrentProfile(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.version).toBe(2); // Последняя версия
    expect(data.data.skinType).toBe('oily');
  });
});
