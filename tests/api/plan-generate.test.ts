// tests/api/plan-generate.test.ts
// API тесты для /api/plan/generate

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GET as generatePlan } from '@/app/api/plan/generate/route';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

const testUserId = 'test-user-api-plan-generate';

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
      
      const telegramId = 'test-user-api-plan-generate';
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

// Мокируем requireTelegramAuth на верхнем уровне
vi.mock('@/lib/auth/telegram-auth', () => ({
  requireTelegramAuth: vi.fn().mockResolvedValue({
    ok: true,
    ctx: { userId: 'test-user-api-plan-generate' },
  }),
}));

describe('GET /api/plan/generate', () => {
  let testQuestionnaireId: number | null = null;
  let testProfileId: number | null = null;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.warn('⚠️ DATABASE_URL not set, skipping API tests');
      return;
    }

    const questionnaire = await prismaTest.questionnaire.findFirst({
      where: { isActive: true },
    });
    testQuestionnaireId = questionnaire?.id || null;
  });

  beforeEach(async () => {
    if (!hasDatabase) return;
    
    mockPrisma = prismaTest;

    // Создаем пользователя если его нет
    const user = await prismaTest.user.upsert({
      where: { telegramId: testUserId },
      update: {},
      create: {
        telegramId: testUserId,
        username: 'test_user',
      },
    });

    // Очистка тестовых данных
    await prismaTest.plan28.deleteMany({
      where: { userId: user.id },
    });
    await prismaTest.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    await prismaTest.userAnswer.deleteMany({
      where: { userId: user.id },
    });

    // Создаем тестовый профиль для генерации плана
    if (testQuestionnaireId) {
      const questionnaire = await prismaTest.questionnaire.findFirst({
        where: { id: testQuestionnaireId },
        include: { questions: { take: 3 } },
      });

      if (questionnaire && questionnaire.questions.length >= 2) {
        // Получаем пользователя
        const user = await prismaTest.user.findUnique({
          where: { telegramId: testUserId },
        });
        if (!user) throw new Error('User not found');

        // Создаем ответы
        await prismaTest.userAnswer.createMany({
          data: questionnaire.questions.slice(0, 2).map((q, idx) => ({
            userId: user.id,
            questionnaireId: testQuestionnaireId!,
            questionId: q.id,
            answerValue: `test_answer_${idx}`,
          })),
        });

        // Создаем профиль
        const profile = await prismaTest.skinProfile.create({
          data: {
            userId: user.id,
            version: 1,
            skinType: 'dry',
            sensitivityLevel: 'low',
            dehydrationLevel: 2,
          },
        });
        testProfileId = profile.id;
      }
    }
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  it('должен запустить генерацию плана', async () => {
    if (!hasDatabase || !testProfileId) {
      console.warn('⚠️ Skipping test: database or test profile not available');
      return;
    }

    const initData = 'test_init_data';
    const request = new NextRequest(
      `http://localhost:3000/api/plan/generate?profileId=${testProfileId}`,
      {
        method: 'GET',
        headers: {
          'X-Telegram-Init-Data': initData,
        },
      }
    );

    const response = await generatePlan(request);
    
    // План может генерироваться асинхронно, поэтому проверяем, что запрос принят
    expect([200, 202]).toContain(response.status);
  });

  it('должен вернуть 200 с state no_profile при отсутствии профиля', async () => {
    if (!hasDatabase) return;

    // Убеждаемся, что у пользователя нет профиля
    const user = await prismaTest.user.findUnique({
      where: { telegramId: testUserId },
    });
    if (user) {
      await prismaTest.skinProfile.deleteMany({
        where: { userId: user.id },
      });
    }

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/plan/generate', {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    });

    const response = await generatePlan(request);
    const data = await response.json();
    
    // API возвращает 200 с state: 'no_profile' при отсутствии профиля
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.state || data.data?.state).toBe('no_profile');
  });
});
