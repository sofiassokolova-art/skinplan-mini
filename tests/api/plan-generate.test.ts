// tests/api/plan-generate.test.ts
// API тесты для /api/plan/generate

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GET as generatePlan } from '@/app/api/plan/generate/route';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

const testUserId = 'test-user-api-plan-generate';

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

    // Очистка тестовых данных
    await prismaTest.plan28.deleteMany({
      where: { userId: testUserId },
    });
    await prismaTest.skinProfile.deleteMany({
      where: { userId: testUserId },
    });
    await prismaTest.userAnswer.deleteMany({
      where: { userId: testUserId },
    });

    // Создаем тестовый профиль для генерации плана
    if (testQuestionnaireId) {
      const questionnaire = await prismaTest.questionnaire.findFirst({
        where: { id: testQuestionnaireId },
        include: { questions: { take: 3 } },
      });

      if (questionnaire && questionnaire.questions.length >= 2) {
        // Создаем ответы
        await prismaTest.userAnswer.createMany({
          data: questionnaire.questions.slice(0, 2).map((q, idx) => ({
            userId: testUserId,
            questionId: q.id,
            answerValue: `test_answer_${idx}`,
          })),
        });

        // Создаем профиль
        const profile = await prismaTest.skinProfile.create({
          data: {
            userId: testUserId,
            version: 1,
            skinType: 'dry',
            concerns: ['moisturizing'],
            diagnoses: [],
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

    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await generatePlan(request);
    
    // План может генерироваться асинхронно, поэтому проверяем, что запрос принят
    expect([200, 202]).toContain(response.status);
  });

  it('должен вернуть ошибку при отсутствии profileId', async () => {
    if (!hasDatabase) return;

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/plan/generate', {
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

    const response = await generatePlan(request);
    expect([400, 404]).toContain(response.status);
  });
});
