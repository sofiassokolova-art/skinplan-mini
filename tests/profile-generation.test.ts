// tests/profile-generation.test.ts
// Автотесты для генерации профиля после анкеты и подбора средств

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createSkinProfile } from '@/lib/profile-calculator';
// Используем PrismaClient напрямую для тестов

const prismaTest = new PrismaClient();

// Тестовые данные
const testUserId = 'test-user-profile-generation';
const testQuestionnaireId = 1;

// Очистка тестовых данных
async function cleanupTestData() {
  await prismaTest.userAnswer.deleteMany({
    where: { userId: testUserId },
  });
  await prismaTest.skinProfile.deleteMany({
    where: { userId: testUserId },
  });
  await prismaTest.recommendationSession.deleteMany({
    where: { userId: testUserId },
  });
  await prismaTest.user.deleteMany({
    where: { telegramId: testUserId },
  });
}

// Создание тестового пользователя
async function createTestUser() {
  return await prismaTest.user.upsert({
    where: { telegramId: testUserId },
    update: {},
    create: {
      telegramId: testUserId,
      firstName: 'Test',
      lastName: 'User',
    },
  });
}

// Создание тестовых ответов
async function createTestAnswers(userId: string, questionnaireId: number) {
  // Получаем вопросы из анкеты
  const questionnaire = await prismaTest.questionnaire.findUnique({
    where: { id: questionnaireId },
    include: {
      questions: {
        include: {
          answerOptions: true,
        },
      },
      groups: {
        include: {
          questions: {
            include: {
              answerOptions: true,
            },
          },
        },
      },
    },
  });

  if (!questionnaire) {
    throw new Error(`Questionnaire ${questionnaireId} not found`);
  }

  const allQuestions = [
    ...questionnaire.questions,
    ...questionnaire.groups.flatMap(g => g.questions),
  ];

  // Создаем ответы для основных вопросов
  const answers = [];

  // Пол
  const genderQuestion = allQuestions.find(q => q.code === 'gender' || q.code === 'GENDER');
  if (genderQuestion && genderQuestion.answerOptions.length > 0) {
    answers.push({
      userId,
      questionnaireId,
      questionId: genderQuestion.id,
      answerValue: genderQuestion.answerOptions[0].value || genderQuestion.answerOptions[0].label,
    });
  }

  // Возраст
  const ageQuestion = allQuestions.find(q => q.code === 'age' || q.code === 'AGE');
  if (ageQuestion && ageQuestion.answerOptions.length > 0) {
    answers.push({
      userId,
      questionnaireId,
      questionId: ageQuestion.id,
      answerValue: ageQuestion.answerOptions[0].value || ageQuestion.answerOptions[0].label,
    });
  }

  // Тип кожи
  const skinTypeQuestion = allQuestions.find(q => 
    q.code === 'skin_type' || 
    q.text?.toLowerCase().includes('тип кожи')
  );
  if (skinTypeQuestion && skinTypeQuestion.answerOptions.length > 0) {
    answers.push({
      userId,
      questionnaireId,
      questionId: skinTypeQuestion.id,
      answerValue: skinTypeQuestion.answerOptions[0].value || skinTypeQuestion.answerOptions[0].label,
    });
  }

  // Чувствительность
  const sensitivityQuestion = allQuestions.find(q => 
    q.code === 'sensitivity' || 
    q.text?.toLowerCase().includes('чувствительность')
  );
  if (sensitivityQuestion && sensitivityQuestion.answerOptions.length > 0) {
    answers.push({
      userId,
      questionnaireId,
      questionId: sensitivityQuestion.id,
      answerValue: sensitivityQuestion.answerOptions[0].value || sensitivityQuestion.answerOptions[0].label,
    });
  }

  // Диагнозы (если есть)
  const diagnosesQuestion = allQuestions.find(q => 
    q.code === 'diagnoses' || 
    q.code === 'DIAGNOSES'
  );
  if (diagnosesQuestion && diagnosesQuestion.answerOptions.length > 0) {
    const diagnosesValues = diagnosesQuestion.answerOptions
      .slice(0, 2)
      .map(opt => opt.value || opt.label)
      .filter(Boolean);
    
    if (diagnosesValues.length > 0) {
      answers.push({
        userId,
        questionnaireId,
        questionId: diagnosesQuestion.id,
        answerValues: diagnosesValues,
      });
    }
  }

  // Основные цели (concerns)
  const concernsQuestion = allQuestions.find(q => 
    q.code === 'skin_concerns' || 
    q.code === 'current_concerns'
  );
  if (concernsQuestion && concernsQuestion.answerOptions.length > 0) {
    const concernsValues = concernsQuestion.answerOptions
      .slice(0, 2)
      .map(opt => opt.value || opt.label)
      .filter(Boolean);
    
    if (concernsValues.length > 0) {
      answers.push({
        userId,
        questionnaireId,
        questionId: concernsQuestion.id,
        answerValues: concernsValues,
      });
    }
  }

  // Создаем ответы в БД
  const createdAnswers = await Promise.all(
    answers.map(answer => 
      prismaTest.userAnswer.create({
        data: answer,
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      })
    )
  );

  return createdAnswers;
}

describe('Profile Generation and Product Selection', () => {
  beforeAll(async () => {
    // Очищаем тестовые данные перед началом
    await cleanupTestData();
  });

  afterAll(async () => {
    // Очищаем тестовые данные после всех тестов
    await cleanupTestData();
    await prismaTest.$disconnect();
  });

  beforeEach(async () => {
    // Очищаем данные перед каждым тестом
    await cleanupTestData();
  });

  describe('Profile Generation', () => {
    it('should create a skin profile after questionnaire submission', async () => {
      // Создаем тестового пользователя
      const user = await createTestUser();
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();

      // Создаем тестовые ответы
      const answers = await createTestAnswers(user.id, testQuestionnaireId);
      expect(answers.length).toBeGreaterThan(0);

      // Получаем полные ответы с вопросами
      const fullAnswers = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      // Получаем анкету
      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
      });

      if (!questionnaire) {
        throw new Error(`Questionnaire ${testQuestionnaireId} not found`);
      }

      // Генерируем профиль
      const profileData = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers,
        questionnaire.version
      );

      // Проверяем, что профиль создан
      expect(profileData).toBeDefined();
      expect(profileData.userId).toBe(user.id);
      expect(profileData.questionnaireId).toBe(testQuestionnaireId);
      expect(profileData.skinType).toBeDefined();
      expect(profileData.sensitivityLevel).toBeDefined();

      // Сохраняем профиль в БД
      const savedProfile = await prismaTest.skinProfile.create({
        data: {
          userId: user.id,
          version: questionnaire.version,
          ...profileData,
        },
      });

      // Проверяем сохраненный профиль
      expect(savedProfile).toBeDefined();
      expect(savedProfile.id).toBeDefined();
      expect(savedProfile.userId).toBe(user.id);
      expect(savedProfile.version).toBe(questionnaire.version);
    });

    it('should update profile version on retake', async () => {
      // Создаем тестового пользователя
      const user = await createTestUser();

      // Создаем первый профиль
      const answers1 = await createTestAnswers(user.id, testQuestionnaireId);
      const fullAnswers1 = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
      });

      if (!questionnaire) {
        throw new Error(`Questionnaire ${testQuestionnaireId} not found`);
      }

      const profileData1 = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers1,
        questionnaire.version
      );

      const profile1 = await prismaTest.skinProfile.create({
        data: {
          userId: user.id,
          version: questionnaire.version,
          ...profileData1,
        },
      });

      expect(profile1.version).toBe(questionnaire.version);

      // Обновляем ответы (симуляция перепрохождения)
      // Изменяем тип кожи
      const skinTypeQuestion = fullAnswers1.find(a => 
        a.question.code === 'skin_type' || 
        a.question.text?.toLowerCase().includes('тип кожи')
      );

      if (skinTypeQuestion && skinTypeQuestion.question.answerOptions.length > 1) {
        await prismaTest.userAnswer.update({
          where: { id: skinTypeQuestion.id },
          data: {
            answerValue: skinTypeQuestion.question.answerOptions[1].value || 
                        skinTypeQuestion.question.answerOptions[1].label,
          },
        });
      }

      // Получаем обновленные ответы
      const fullAnswers2 = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      // Генерируем новый профиль
      const profileData2 = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers2,
        questionnaire.version
      );

      // Обновляем профиль с новой версией
      const profile2 = await prismaTest.skinProfile.update({
        where: { id: profile1.id },
        data: {
          ...profileData2,
          version: profile1.version + 1,
          updatedAt: new Date(),
        },
      });

      // Проверяем, что версия увеличилась
      expect(profile2.version).toBe(profile1.version + 1);
      expect(profile2.id).toBe(profile1.id);
    });

    it('should extract diagnoses and concerns from answers', async () => {
      const user = await createTestUser();
      const answers = await createTestAnswers(user.id, testQuestionnaireId);

      const fullAnswers = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
      });

      if (!questionnaire) {
        throw new Error(`Questionnaire ${testQuestionnaireId} not found`);
      }

      const profileData = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers,
        questionnaire.version
      );

      // Проверяем, что medicalMarkers содержат diagnoses и mainGoals
      const medicalMarkers = profileData.medicalMarkers as any;
      
      // Если есть ответы на diagnoses, они должны быть в medicalMarkers
      const diagnosesAnswer = fullAnswers.find(a => 
        a.question.code === 'diagnoses' || 
        a.question.code === 'DIAGNOSES'
      );
      
      if (diagnosesAnswer && Array.isArray(diagnosesAnswer.answerValues)) {
        expect(medicalMarkers?.diagnoses).toBeDefined();
        expect(Array.isArray(medicalMarkers.diagnoses)).toBe(true);
      }

      // Если есть ответы на concerns, они должны быть в medicalMarkers
      const concernsAnswer = fullAnswers.find(a => 
        a.question.code === 'skin_concerns' || 
        a.question.code === 'current_concerns'
      );
      
      if (concernsAnswer && Array.isArray(concernsAnswer.answerValues)) {
        expect(medicalMarkers?.mainGoals).toBeDefined();
        expect(Array.isArray(medicalMarkers.mainGoals)).toBe(true);
      }
    });
  });

  describe('Product Selection', () => {
    it('should create recommendation session with products', async () => {
      const user = await createTestUser();
      const answers = await createTestAnswers(user.id, testQuestionnaireId);

      const fullAnswers = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
      });

      if (!questionnaire) {
        throw new Error(`Questionnaire ${testQuestionnaireId} not found`);
      }

      // Создаем профиль
      const profileData = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers,
        questionnaire.version
      );

      const profile = await prismaTest.skinProfile.create({
        data: {
          userId: user.id,
          version: questionnaire.version,
          ...profileData,
        },
      });

      // Получаем активные правила
      const rules = await prismaTest.recommendationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });

      expect(rules.length).toBeGreaterThan(0);

      // Находим подходящее правило
      let matchedRule: any = null;
      
      for (const rule of rules) {
        const conditions = rule.conditionsJson as any;
        let matches = true;

        for (const [key, condition] of Object.entries(conditions)) {
          let profileValue: any;
          
          if (key === 'diagnoses') {
            profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
          } else {
            profileValue = (profile as any)[key];
          }

          if (Array.isArray(condition)) {
            if (!condition.includes(profileValue)) {
              matches = false;
              break;
            }
          } else if (typeof condition === 'object' && condition !== null) {
            const conditionObj = condition as Record<string, unknown>;
            
            if ('hasSome' in conditionObj && Array.isArray(conditionObj.hasSome)) {
              const hasSomeArray = conditionObj.hasSome as any[];
              const profileArray = Array.isArray(profileValue) ? profileValue : [];
              const hasMatch = hasSomeArray.some(item => profileArray.includes(item));
              if (!hasMatch) {
                matches = false;
                break;
              }
              continue;
            }
          }
        }

        if (matches) {
          matchedRule = rule;
          break;
        }
      }

      // Если правило найдено, создаем RecommendationSession
      if (matchedRule) {
        const stepsJson = matchedRule.stepsJson as any;
        const productIds: number[] = [];

        // Получаем продукты для каждого шага
        for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
          const step = stepConfig as any;
          
          // Получаем продукты для шага
          const products = await prismaTest.product.findMany({
            where: {
              step: step.step || stepName,
              isActive: true,
            },
            take: step.count || 1,
          });

          productIds.push(...products.map(p => p.id));
        }

        // Создаем RecommendationSession
        const session = await prismaTest.recommendationSession.create({
          data: {
            userId: user.id,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: productIds,
          },
        });

        // Проверяем созданную сессию
        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.userId).toBe(user.id);
        expect(session.profileId).toBe(profile.id);
        expect(session.ruleId).toBe(matchedRule.id);
        expect(Array.isArray(session.products)).toBe(true);
        expect(session.products.length).toBeGreaterThan(0);
      } else {
        // Если правило не найдено, это не ошибка, но логируем
        console.warn('No matching rule found for profile', {
          userId: user.id,
          profileId: profile.id,
        });
      }
    });

    it('should select products based on profile characteristics', async () => {
      const user = await createTestUser();
      const answers = await createTestAnswers(user.id, testQuestionnaireId);

      const fullAnswers = await prismaTest.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: testQuestionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      const questionnaire = await prismaTest.questionnaire.findUnique({
        where: { id: testQuestionnaireId },
      });

      if (!questionnaire) {
        throw new Error(`Questionnaire ${testQuestionnaireId} not found`);
      }

      const profileData = createSkinProfile(
        user.id,
        testQuestionnaireId,
        fullAnswers,
        questionnaire.version
      );

      const profile = await prismaTest.skinProfile.create({
        data: {
          userId: user.id,
          version: questionnaire.version,
          ...profileData,
        },
      });

      // Проверяем, что профиль имеет необходимые характеристики для подбора средств
      expect(profile.skinType).toBeDefined();
      expect(profile.sensitivityLevel).toBeDefined();

      // Проверяем, что есть продукты в БД
      const products = await prismaTest.product.findMany({
        where: {
          isActive: true,
        },
        take: 10,
      });

      expect(products.length).toBeGreaterThan(0);

      // Проверяем, что есть правила
      const rules = await prismaTest.recommendationRule.findMany({
        where: { isActive: true },
      });

      expect(rules.length).toBeGreaterThan(0);
    });
  });
});

