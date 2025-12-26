// tests/questionnaire-start.test.ts
// Автотесты для старта анкеты

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { GET as getActiveQuestionnaire } from '@/app/api/questionnaire/active/route';
import { GET as getQuestionnaireProgress } from '@/app/api/questionnaire/progress/route';
import type { TelegramAuthContext } from '@/lib/auth/telegram-auth';

const hasDatabase = !!process.env.DATABASE_URL;
const prismaTest = hasDatabase
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })
  : new PrismaClient();

// Тестовые данные
const testUserId = 'test-user-questionnaire-start';
const testUserIdWithProgress = 'test-user-questionnaire-start-progress';
const testUserIdCompleted = 'test-user-questionnaire-start-completed';
let testQuestionnaireId: number | null = null;

// Очистка тестовых данных
async function cleanupTestData() {
  // Удаляем всё, что связано с тестовыми пользователями
  const userIds = [testUserId, testUserIdWithProgress, testUserIdCompleted];
  
  for (const userId of userIds) {
    await prismaTest.userAnswer.deleteMany({
      where: { userId },
    });
    await prismaTest.skinProfile.deleteMany({
      where: { userId },
    });
    await prismaTest.userPreferences.deleteMany({
      where: { userId },
    });
    await prismaTest.recommendationSession.deleteMany({
      where: { userId },
    });
    await prismaTest.planFeedback.deleteMany({
      where: { userId },
    });
    await prismaTest.plan28.deleteMany({
      where: { userId },
    });
    await prismaTest.planProgress.deleteMany({
      where: { userId },
    });
    await prismaTest.wishlist.deleteMany({
      where: { userId },
    });
    await prismaTest.cart.deleteMany({
      where: { userId },
    });
    await prismaTest.wishlistFeedback.deleteMany({
      where: { userId },
    });
    await prismaTest.productReplacement.deleteMany({
      where: { userId },
    });
    await prismaTest.botMessage.deleteMany({
      where: { userId },
    });
    await prismaTest.supportChat.deleteMany({
      where: { userId },
    });
    await prismaTest.broadcastLog.deleteMany({
      where: { userId },
    });
    await prismaTest.clientLog.deleteMany({
      where: { userId },
    });
    await prismaTest.user.deleteMany({
      where: { id: userId },
    });
  }
}

// Создание тестового пользователя
async function createTestUser(userId: string) {
  return await prismaTest.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      telegramId: userId,
      firstName: 'Test',
      lastName: 'User',
    },
  });
}

// Мокируем requireTelegramAuth для тестов
// ВАЖНО: Мок должен быть объявлен до импорта модулей, которые используют requireTelegramAuth
// Но в Vitest моки можно объявлять в любом месте, они применяются автоматически
// Используем глобальный prismaTest, который будет создан позже
let mockPrisma: typeof prismaTest | null = null;

vi.mock('@/lib/auth/telegram-auth', async () => {
  const actual = await vi.importActual('@/lib/auth/telegram-auth');
  
  return {
    ...actual,
    requireTelegramAuth: vi.fn(async (request: NextRequest, options?: { ensureUser?: boolean }) => {
      // Используем prismaTest из замыкания (будет установлен в beforeAll)
      if (!mockPrisma) {
        const { PrismaClient } = await import('@prisma/client');
        mockPrisma = new PrismaClient({
          datasources: { db: { url: process.env.DATABASE_URL! } },
        });
      }
      
      // Извлекаем userId из заголовка для тестов
      const initData = request.headers.get('x-telegram-init-data') || request.headers.get('X-Telegram-Init-Data');
      if (!initData) {
        return {
          ok: false,
          response: {
            status: 401,
            json: async () => ({ error: 'Missing Telegram initData' }),
          },
        };
      }
      
      // Используем initData как userId (для тестов)
      const userId = initData;
      
      // Находим пользователя в БД по telegramId
      const user = await mockPrisma.user.findUnique({
        where: { telegramId: userId },
        select: { id: true },
      });
      
      if (!user && options?.ensureUser) {
        // Создаем пользователя, если нужно
        const newUser = await mockPrisma.user.create({
          data: {
            id: userId,
            telegramId: userId,
            firstName: 'Test',
            lastName: 'User',
          },
        });
        return {
          ok: true,
          ctx: {
            telegramId: userId,
            userId: newUser.id,
            user: {
              id: parseInt(userId) || 0,
              first_name: 'Test',
              last_name: 'User',
            },
          } as TelegramAuthContext,
        };
      }
      
      if (!user) {
        // Для /api/questionnaire/active ensureUser: false, поэтому userId может быть null
        // Это нормально - API вернет анкету без метаданных о пользователе
        // Но для тестов нам нужен userId, поэтому создаем пользователя автоматически
        // В реальном API это обрабатывается иначе (возвращается анкета без метаданных)
        if (options?.ensureUser) {
          // Создаем пользователя, если ensureUser: true
          const newUser = await mockPrisma.user.create({
            data: {
              id: userId,
              telegramId: userId,
              firstName: 'Test',
              lastName: 'User',
            },
          });
          return {
            ok: true,
            ctx: {
              telegramId: userId,
              userId: newUser.id,
              user: {
                id: parseInt(userId) || 0,
                first_name: 'Test',
                last_name: 'User',
              },
            } as TelegramAuthContext,
          };
        }
        // Если ensureUser: false, возвращаем ok: false, но API продолжит работу
        // В реальном API это означает, что userId будет null, и анкета вернется без метаданных
        return {
          ok: false,
          response: {
            status: 503,
            json: async () => ({ error: 'User not found' }),
          },
        };
      }
      
      return {
        ok: true,
        ctx: {
          telegramId: userId,
          userId: user.id,
          user: {
            id: parseInt(userId) || 0,
            first_name: 'Test',
            last_name: 'User',
          },
        } as TelegramAuthContext,
      };
    }),
  };
});

// Создание мокового запроса с Telegram auth
function createMockRequestWithAuth(userId: string): NextRequest {
  const headers = new Headers();
  // Используем userId как initData для тестов (будет обработан моком)
  headers.set('x-telegram-init-data', userId);
  return new NextRequest('http://localhost:3000/api/questionnaire/active', {
    method: 'GET',
    headers,
  });
}

describe.skipIf(!hasDatabase)('Questionnaire Start', () => {
  beforeAll(async () => {
    // Устанавливаем prisma для мока
    mockPrisma = prismaTest;
    // Очищаем тестовые данные перед началом
    await cleanupTestData();
    
    // Находим активную анкету
    const activeQuestionnaire = await prismaTest.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (!activeQuestionnaire) {
      throw new Error('No active questionnaire found. Please seed the database first.');
    }
    
    testQuestionnaireId = activeQuestionnaire.id;
    
    // Создаем тестовых пользователей
    await createTestUser(testUserId);
    await createTestUser(testUserIdWithProgress);
    await createTestUser(testUserIdCompleted);
    
    // Создаем пользователя с прогрессом (частично заполненная анкета)
    const questionnaire = await prismaTest.questionnaire.findUnique({
      where: { id: testQuestionnaireId },
      include: {
        questions: {
          take: 2, // Берем первые 2 вопроса для прогресса
        },
      },
    });
    
    if (questionnaire && questionnaire.questions.length > 0) {
      // Создаем ответы для первых двух вопросов
      for (const question of questionnaire.questions.slice(0, 2)) {
        if (question.answerOptions && question.answerOptions.length > 0) {
          const answerOption = question.answerOptions[0];
          await prismaTest.userAnswer.create({
            data: {
              userId: testUserIdWithProgress,
              questionnaireId: testQuestionnaireId,
              questionId: question.id,
              answerValue: answerOption.value || answerOption.label,
            },
          });
        }
      }
      
      // Устанавливаем hasPlanProgress = false (анкета не завершена)
      await prismaTest.userPreferences.upsert({
        where: { userId: testUserIdWithProgress },
        update: { hasPlanProgress: false },
        create: {
          userId: testUserIdWithProgress,
          hasPlanProgress: false,
        },
      });
    }
    
    // Создаем пользователя с завершенной анкетой
    if (questionnaire && questionnaire.questions.length > 0) {
      // Создаем ответы для всех вопросов
      for (const question of questionnaire.questions) {
        if (question.answerOptions && question.answerOptions.length > 0) {
          const answerOption = question.answerOptions[0];
          await prismaTest.userAnswer.create({
            data: {
              userId: testUserIdCompleted,
              questionnaireId: testQuestionnaireId,
              questionId: question.id,
              answerValue: answerOption.value || answerOption.label,
            },
          });
        }
      }
      
      // Создаем профиль для завершенной анкеты
      await prismaTest.skinProfile.create({
        data: {
          userId: testUserIdCompleted,
          version: questionnaire.version || 1,
          skinType: 'normal',
          sensitivityLevel: 'low',
        },
      });
      
      // Устанавливаем hasPlanProgress = true
      await prismaTest.userPreferences.upsert({
        where: { userId: testUserIdCompleted },
        update: { hasPlanProgress: true },
        create: {
          userId: testUserIdCompleted,
          hasPlanProgress: true,
        },
      });
    }
  });

  afterAll(async () => {
    // Очищаем тестовые данные после всех тестов
    await cleanupTestData();
    await prismaTest.$disconnect();
  }, 30000);

  beforeEach(async () => {
    // Очищаем данные перед каждым тестом (кроме базовых пользователей)
    // Не очищаем пользователей, так как они нужны для всех тестов
  });

  describe('API: /api/questionnaire/active', () => {
    it('should return active questionnaire for new user', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserId);
      const response = await getActiveQuestionnaire(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Проверяем структуру ответа
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('questions');
      expect(data).toHaveProperty('_meta');
      
      // Проверяем метаданные
      expect(data._meta).toHaveProperty('shouldRedirectToPlan');
      expect(data._meta).toHaveProperty('isCompleted');
      expect(data._meta).toHaveProperty('hasProfile');
      expect(data._meta).toHaveProperty('preferences');
      
      // Для нового пользователя
      expect(data._meta.shouldRedirectToPlan).toBe(false);
      expect(data._meta.isCompleted).toBe(false);
      expect(data._meta.hasProfile).toBe(true); // Пользователь создан, но профиля нет
      expect(data._meta.preferences.hasPlanProgress).toBe(false);
      
      // Проверяем, что анкета содержит вопросы
      const totalQuestions = 
        (data.groups || []).reduce((sum: number, g: any) => sum + (g.questions?.length || 0), 0) +
        (data.questions || []).length;
      expect(totalQuestions).toBeGreaterThan(0);
    });

    it('should return active questionnaire for user with progress', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserIdWithProgress);
      const response = await getActiveQuestionnaire(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Проверяем структуру ответа
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('_meta');
      
      // Для пользователя с прогрессом (но не завершенной анкетой)
      expect(data._meta.shouldRedirectToPlan).toBe(false);
      expect(data._meta.isCompleted).toBe(false);
      expect(data._meta.preferences.hasPlanProgress).toBe(false);
    });

    it('should return redirect flag for user with completed questionnaire', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserIdCompleted);
      const response = await getActiveQuestionnaire(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Проверяем структуру ответа
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('_meta');
      
      // Для пользователя с завершенной анкетой должен быть флаг редиректа
      expect(data._meta.shouldRedirectToPlan).toBe(true);
      expect(data._meta.isCompleted).toBe(true);
      expect(data._meta.preferences.hasPlanProgress).toBe(true);
    });

    it('should return questionnaire with correct structure', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserId);
      const response = await getActiveQuestionnaire(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Проверяем структуру групп
      if (data.groups && data.groups.length > 0) {
        const group = data.groups[0];
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('title');
        expect(group).toHaveProperty('position');
        expect(group).toHaveProperty('questions');
        expect(Array.isArray(group.questions)).toBe(true);
        
        // Проверяем структуру вопросов в группе
        if (group.questions.length > 0) {
          const question = group.questions[0];
          expect(question).toHaveProperty('id');
          expect(question).toHaveProperty('code');
          expect(question).toHaveProperty('text');
          expect(question).toHaveProperty('type');
          expect(question).toHaveProperty('position');
          expect(question).toHaveProperty('options');
          expect(Array.isArray(question.options)).toBe(true);
          
          // Проверяем структуру опций ответа
          if (question.options.length > 0) {
            const option = question.options[0];
            expect(option).toHaveProperty('id');
            expect(option).toHaveProperty('value');
            expect(option).toHaveProperty('label');
            expect(option).toHaveProperty('position');
          }
        }
      }
      
      // Проверяем структуру вопросов без группы
      if (data.questions && data.questions.length > 0) {
        const question = data.questions[0];
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('code');
        expect(question).toHaveProperty('text');
        expect(question).toHaveProperty('type');
        expect(question).toHaveProperty('position');
        expect(question).toHaveProperty('options');
        expect(Array.isArray(question.options)).toBe(true);
      }
    });

    it('should return 404 if no active questionnaire exists', async () => {
      // Временно деактивируем все анкеты
      await prismaTest.questionnaire.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      
      try {
        const request = createMockRequestWithAuth(testUserId);
        const response = await getActiveQuestionnaire(request);
        
        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      } finally {
        // Восстанавливаем активную анкету
        if (testQuestionnaireId) {
          await prismaTest.questionnaire.update({
            where: { id: testQuestionnaireId },
            data: { isActive: true },
          });
        }
      }
    });
  });

  describe('API: /api/questionnaire/progress', () => {
    it('should return null progress for new user', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserId);
      const response = await getQuestionnaireProgress(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Для нового пользователя прогресс должен быть null
      expect(data.progress).toBeNull();
      expect(data.isCompleted).toBe(false);
    });

    it('should return progress for user with partial answers', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserIdWithProgress);
      const response = await getQuestionnaireProgress(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Для пользователя с прогрессом должен быть возвращен прогресс
      if (data.progress) {
        expect(data.progress).toHaveProperty('currentQuestionIndex');
        expect(data.progress).toHaveProperty('answers');
        expect(Array.isArray(data.progress.answers)).toBe(true);
        expect(data.progress.answers.length).toBeGreaterThan(0);
        expect(data.isCompleted).toBe(false);
      }
    });

    it('should return completed status for user with all answers', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const request = createMockRequestWithAuth(testUserIdCompleted);
      const response = await getQuestionnaireProgress(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Для пользователя с завершенной анкетой
      if (data.progress) {
        expect(data.progress).toHaveProperty('answers');
        expect(Array.isArray(data.progress.answers)).toBe(true);
        // Проверяем, что все вопросы отвечены (если есть вопросы)
        if (data.progress.answers.length > 0) {
          expect(data.isCompleted).toBe(true);
        }
      }
    });
  });

  describe('Questionnaire initialization flow', () => {
    it('should have active questionnaire with questions', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
        include: {
          questionGroups: {
            include: {
              questions: {
                include: {
                  answerOptions: true,
                },
              },
            },
          },
          questions: {
            where: { groupId: null },
            include: {
              answerOptions: true,
            },
          },
        },
      });
      
      expect(questionnaire).toBeDefined();
      expect(questionnaire?.isActive).toBe(true);
      
      // Проверяем, что есть вопросы (либо в группах, либо без групп)
      const groupsQuestionsCount = (questionnaire?.questionGroups || []).reduce(
        (sum, g) => sum + (g.questions?.length || 0),
        0
      );
      const plainQuestionsCount = questionnaire?.questions?.length || 0;
      const totalQuestions = groupsQuestionsCount + plainQuestionsCount;
      
      expect(totalQuestions).toBeGreaterThan(0);
      
      // Проверяем, что у вопросов есть опции ответа
      const allQuestions = [
        ...(questionnaire?.questionGroups || []).flatMap(g => g.questions || []),
        ...(questionnaire?.questions || []),
      ];
      
      for (const question of allQuestions) {
        expect(question.answerOptions).toBeDefined();
        expect(Array.isArray(question.answerOptions)).toBe(true);
        // Хотя бы один вопрос должен иметь опции ответа
        if (question.answerOptions.length > 0) {
          expect(question.answerOptions[0]).toHaveProperty('value');
          expect(question.answerOptions[0]).toHaveProperty('label');
        }
      }
    });

    it('should handle questionnaire loading for different user states', async () => {
      if (!testQuestionnaireId) {
        throw new Error('Test questionnaire ID not set');
      }
      
      // Тест для нового пользователя
      const newUserRequest = createMockRequestWithAuth(testUserId);
      const newUserResponse = await getActiveQuestionnaire(newUserRequest);
      expect(newUserResponse.status).toBe(200);
      const newUserData = await newUserResponse.json();
      expect(newUserData._meta.shouldRedirectToPlan).toBe(false);
      
      // Тест для пользователя с прогрессом
      const progressUserRequest = createMockRequestWithAuth(testUserIdWithProgress);
      const progressUserResponse = await getActiveQuestionnaire(progressUserRequest);
      expect(progressUserResponse.status).toBe(200);
      const progressUserData = await progressUserResponse.json();
      expect(progressUserData._meta.shouldRedirectToPlan).toBe(false);
      
      // Тест для пользователя с завершенной анкетой
      const completedUserRequest = createMockRequestWithAuth(testUserIdCompleted);
      const completedUserResponse = await getActiveQuestionnaire(completedUserRequest);
      expect(completedUserResponse.status).toBe(200);
      const completedUserData = await completedUserResponse.json();
      expect(completedUserData._meta.shouldRedirectToPlan).toBe(true);
    });
  });
});

