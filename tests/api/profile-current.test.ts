// tests/api/profile-current.test.ts
// API тесты для /api/profile/current

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GET as getCurrentProfile } from '@/app/api/profile/current/route';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

const testUserId = 'test-user-api-profile-current';

// Мокируем requireTelegramAuth на верхнем уровне
let mockPrisma: typeof prismaTest | null = null;

vi.mock('@/lib/auth/telegram-auth', async () => {
  const actual = await vi.importActual('@/lib/auth/telegram-auth');
  
  return {
    ...actual,
    requireTelegramAuth: vi.fn(async (request: NextRequest) => {
      if (!mockPrisma) {
        mockPrisma = prismaTest;
      }
      
      const telegramId = 'test-user-api-profile-current';
      const user = await mockPrisma!.user.findUnique({
        where: { telegramId },
        select: { id: true },
      });
      
      if (!user) {
        return {
          ok: false,
          response: { status: 503, json: async () => ({ error: 'User not found' }) },
        };
      }
      
      return {
        ok: true,
        ctx: { 
          userId: user.id,
          telegramId,
          user: { id: 123, first_name: 'Test' },
        },
      };
    }),
  };
});

describe('GET /api/profile/current', () => {
  beforeEach(async () => {
    if (!hasDatabase) return;
    
    mockPrisma = prismaTest;

    // Создаем пользователя если его нет
    await prismaTest.user.upsert({
      where: { telegramId: testUserId },
      update: {},
      create: {
        telegramId: testUserId,
        username: 'test_user',
      },
    });

    // Очистка тестовых данных
    const user = await prismaTest.user.findUnique({
      where: { telegramId: testUserId },
    });
    if (user) {
      await prismaTest.skinProfile.deleteMany({
        where: { userId: user.id },
      });
    }
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  it('должен вернуть текущий профиль пользователя', async () => {
    if (!hasDatabase) {
      console.warn('⚠️ DATABASE_URL not set, skipping API tests');
      return;
    }

    // Получаем пользователя
    const user = await prismaTest.user.findUnique({
      where: { telegramId: testUserId },
    });
    if (!user) throw new Error('User not found');

    // Создаем тестовый профиль
    const profile = await prismaTest.skinProfile.create({
      data: {
        userId: user.id,
        version: 1,
        skinType: 'dry',
        sensitivityLevel: 'low',
        dehydrationLevel: 2,
        acneLevel: 1,
      },
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/profile/current', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    const response = await getCurrentProfile(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.id).toBe(profile.id);
    expect(data.data.userId).toBe(testUserId);
    expect(data.data.skinType).toBe('dry');
  });

  it('должен вернуть 200 с null если профиль не найден', async () => {
    if (!hasDatabase) return;

    // Получаем пользователя
    const user = await prismaTest.user.findUnique({
      where: { telegramId: testUserId },
    });
    if (!user) throw new Error('User not found');

    // Убеждаемся, что профиля нет
    await prismaTest.skinProfile.deleteMany({
      where: { userId: user.id },
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/profile/current', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    const response = await getCurrentProfile(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.data).toBeNull();
  });

  it('должен вернуть последнюю версию профиля', async () => {
    if (!hasDatabase) return;

    // Получаем пользователя
    const user = await prismaTest.user.findUnique({
      where: { telegramId: testUserId },
    });
    if (!user) throw new Error('User not found');

    // Создаем несколько версий профиля
    await prismaTest.skinProfile.createMany({
      data: [
        {
          userId: user.id,
          version: 1,
          skinType: 'dry',
          sensitivityLevel: 'low',
          dehydrationLevel: 2,
        },
        {
          userId: user.id,
          version: 2,
          skinType: 'oily',
          sensitivityLevel: 'medium',
          acneLevel: 3,
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

    const response = await getCurrentProfile(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.version).toBe(2); // Последняя версия
    expect(data.data.skinType).toBe('oily');
  });
});
