// tests/api/questionnaire-answers.test.ts
// API тесты для /api/questionnaire/answers

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { POST as postAnswers, GET as getAnswers } from '@/app/api/questionnaire/answers/route';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

const testUserId = 'test-user-api-answers';

describe('POST /api/questionnaire/answers', () => {
  let testQuestionnaireId: number | null = null;
  let testQuestionIds: number[] = [];

  beforeAll(async () => {
    if (!hasDatabase) {
      console.warn('⚠️ DATABASE_URL not set, skipping API tests');
      return;
    }

    // Получаем активную анкету или создаем тестовую
    const questionnaire = await prismaTest.questionnaire.findFirst({
      where: { isActive: true },
      include: { questions: { take: 3 } },
    });

    if (questionnaire && questionnaire.questions.length >= 2) {
      testQuestionnaireId = questionnaire.id;
      testQuestionIds = questionnaire.questions.slice(0, 2).map(q => q.id);
    }
  });

  beforeEach(async () => {
    if (!hasDatabase) return;

    // Очистка тестовых данных
    await prismaTest.userAnswer.deleteMany({
      where: { userId: testUserId },
    });
    await prismaTest.skinProfile.deleteMany({
      where: { userId: testUserId },
    });
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  it('должен сохранить ответы пользователя', async () => {
    if (!hasDatabase || !testQuestionnaireId || testQuestionIds.length < 2) {
      console.warn('⚠️ Skipping test: database or test data not available');
      return;
    }

    const initData = 'test_init_data';
    const requestBody = {
      questionnaireId: testQuestionnaireId,
      answers: [
        { questionId: testQuestionIds[0], answerValue: 'test_answer_1' },
        { questionId: testQuestionIds[1], answerValue: 'test_answer_2' },
      ],
    };

    const request = new NextRequest('http://localhost:3000/api/questionnaire/answers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
      },
      body: JSON.stringify(requestBody),
    });

    // Мокаем requireTelegramAuth
    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await postAnswers(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Проверяем, что ответы сохранились в БД
    const savedAnswers = await prismaTest.userAnswer.findMany({
      where: { userId: testQuestionnaireId },
      include: { question: true },
    });

    expect(savedAnswers.length).toBeGreaterThanOrEqual(2);
  });

  it('должен вернуть ошибку при отсутствии questionnaireId', async () => {
    if (!hasDatabase) return;

    const initData = 'test_init_data';
    const requestBody = {
      answers: [{ questionId: 1, answerValue: 'test' }],
    };

    const request = new NextRequest('http://localhost:3000/api/questionnaire/answers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
      },
      body: JSON.stringify(requestBody),
    });

    vi.mock('@/lib/auth/telegram-auth', () => ({
      requireTelegramAuth: vi.fn().mockResolvedValue({
        ok: true,
        ctx: { userId: testUserId },
      }),
    }));

    const response = await postAnswers(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/questionnaire/answers', () => {
  let testQuestionnaireId: number | null = null;

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
    await prismaTest.userAnswer.deleteMany({
      where: { userId: testUserId },
    });
  });

  it('должен вернуть ответы пользователя', async () => {
    if (!hasDatabase || !testQuestionnaireId) {
      console.warn('⚠️ Skipping test: database or test data not available');
      return;
    }

    // Создаем тестовые ответы
    const questionnaire = await prismaTest.questionnaire.findFirst({
      where: { id: testQuestionnaireId },
      include: { questions: { take: 2 } },
    });

    if (!questionnaire || questionnaire.questions.length < 2) {
      console.warn('⚠️ Skipping test: not enough questions');
      return;
    }

    await prismaTest.userAnswer.createMany({
      data: [
        {
          userId: testUserId,
          questionId: questionnaire.questions[0].id,
          answerValue: 'test_answer_1',
        },
        {
          userId: testUserId,
          questionId: questionnaire.questions[1].id,
          answerValue: 'test_answer_2',
        },
      ],
    });

    const initData = 'test_init_data';
    const request = new NextRequest('http://localhost:3000/api/questionnaire/answers', {
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

    const response = await getAnswers(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(2);
  });
});
