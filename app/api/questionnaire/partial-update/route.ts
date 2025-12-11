// app/api/questionnaire/partial-update/route.ts
// API для частичного обновления ответов анкеты по теме

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { buildSkinProfileFromAnswers } from '@/lib/skinprofile-rules-engine';
import { getTopicById, shouldRebuildPlan } from '@/lib/quiz-topics';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/questionnaire/partial-update';
  let userId: string | undefined;

  try {
    const initData =
      request.headers.get('x-telegram-init-data') ||
      request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { topicId, answers } = body;

    if (!topicId || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'topicId and answers array are required' },
        { status: 400 }
      );
    }

    // Получаем тему
    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Invalid topicId' },
        { status: 400 }
      );
    }

    // Получаем активную анкету
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questions: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    if (!questionnaire) {
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    // Получаем текущие ответы пользователя
    const existingAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: true,
      },
    });

    // Обновляем или создаем ответы для выбранной темы
    const updatedFields: string[] = [];
    
    for (const answer of answers) {
      const { questionId, questionCode, value, values } = answer;
      
      // Валидация: должен быть хотя бы один идентификатор
      if (!questionId && !questionCode) {
        logger.warn('Answer missing both questionId and questionCode, skipping', { userId, topicId });
        continue;
      }
      
      // Находим вопрос по ID или коду
      let question = questionId
        ? questionnaire.questions.find(q => q.id === questionId)
        : questionnaire.questions.find(q => q.code === questionCode);

      if (!question) {
        logger.warn('Question not found', { userId, topicId, questionId, questionCode });
        continue;
      }

      // Проверяем, относится ли вопрос к выбранной теме
      const isInTopic = topic.questionIds.includes(question.id) ||
                       (topic.questionCodes && topic.questionCodes.includes(question.code));
      
      if (!isInTopic) {
        logger.warn('Question not in topic', { userId, topicId, questionId: question.id, questionCode: question.code });
        continue;
      }

      // Валидация формата ответа
      if (question.type === 'multi_choice') {
        if (!Array.isArray(values) || values.length === 0) {
          logger.warn('Multi-choice question requires values array', { userId, questionId: question.id });
          continue;
        }
        // Проверяем, что все значения существуют в answerOptions
        const validValues = question.answerOptions.map(opt => opt.value);
        const invalidValues = values.filter(v => !validValues.includes(v));
        if (invalidValues.length > 0) {
          logger.warn('Invalid values for question', { userId, questionId: question.id, invalidValues });
          continue;
        }
      } else {
        if (!value) {
          logger.warn('Single-choice question requires value', { userId, questionId: question.id });
          continue;
        }
        // Проверяем, что значение существует в answerOptions
        const validValues = question.answerOptions.map(opt => opt.value);
        if (!validValues.includes(value)) {
          logger.warn('Invalid value for question', { userId, questionId: question.id, value });
          continue;
        }
      }

      // Удаляем старый ответ, если есть
      await prisma.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId: questionnaire.id,
          questionId: question.id,
        },
      });

      // Создаем новый ответ
      if (question.type === 'multi_choice' && Array.isArray(values)) {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId: questionnaire.id,
            questionId: question.id,
            answerValues: values,
          },
        });
      } else {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId: questionnaire.id,
            questionId: question.id,
            answerValue: value || (Array.isArray(values) ? values[0] : null),
          },
        });
      }

      updatedFields.push(question.code);
    }

    // Получаем все ответы (обновленные + старые)
    // ИСПРАВЛЕНО: Добавлен include для answerOptions, чтобы маппить values на labels
    const allAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    // Преобразуем в формат для skinprofile-rules-engine
    // ИСПРАВЛЕНО: Маппим values опций на labels для правил
    const rawAnswers = allAnswers.map(answer => {
      let answerOptionLabels: string[] | undefined;
      
      // Если есть answerValues (массив values опций), маппим их на labels
      if (answer.answerValues && Array.isArray(answer.answerValues) && answer.question.answerOptions) {
        answerOptionLabels = answer.answerValues
          .map((val: string) => {
            const option = answer.question.answerOptions.find(opt => opt.value === val);
            // Используем label, если есть, иначе text, иначе value
            return (option as any)?.label || option?.text || val;
          })
          .filter(Boolean);
      }
      
      return {
        questionId: answer.questionId,
        questionCode: answer.question.code,
        answerValue: answer.answerValue,
        answerValues: answer.answerValues,
        answerOptionLabels, // ИСПРАВЛЕНО: Добавлено для маппинга values -> labels
      };
    });

    // Получаем текущий профиль
    const currentProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Генерируем новый SkinProfile из всех ответов
    const newProfileData = buildSkinProfileFromAnswers(rawAnswers);

    // Обновляем или создаем SkinProfile
    const medicalMarkers = {
      mainGoals: newProfileData.mainGoals,
      secondaryGoals: newProfileData.secondaryGoals,
      diagnoses: newProfileData.diagnoses,
      contraindications: newProfileData.contraindications,
      currentTopicals: newProfileData.currentTopicals,
      currentOralMeds: newProfileData.currentOralMeds,
      lifestyleFactors: newProfileData.lifestyleFactors,
    };

    const newProfile = await prisma.skinProfile.upsert({
      where: {
        userId_version: {
          userId,
          version: currentProfile?.version || 1,
        },
      },
      update: {
        skinType: newProfileData.skinType,
        sensitivityLevel: newProfileData.sensitivity,
        medicalMarkers,
        notes: `Обновлено через тему: ${topic.title}`,
      },
      create: {
        userId,
        version: (currentProfile?.version || 0) + 1,
        skinType: newProfileData.skinType,
        sensitivityLevel: newProfileData.sensitivity,
        medicalMarkers,
        notes: `Создано через тему: ${topic.title}`,
      },
    });

    // Проверяем, нужно ли пересобирать план
    const needsPlanRebuild = shouldRebuildPlan(topicId);

    // Если нужно пересобрать план, запускаем генерацию в фоне
    let planRegenerated = false;
    if (needsPlanRebuild) {
      try {
        // Вызываем генерацию плана асинхронно (не ждем завершения)
        // Это улучшает UX - пользователь не ждет долгой генерации
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/plan/generate`, {
          method: 'GET',
          headers: {
            'X-Telegram-Init-Data': initData,
          },
        }).catch(err => {
          logger.warn('Background plan regeneration failed', { userId, error: err });
          // Не критично - план пересоберется при следующем запросе
        });
        planRegenerated = true;
      } catch (err) {
        logger.warn('Could not trigger plan regeneration', { userId, error: err });
      }
    }

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      success: true,
      profile: {
        id: newProfile.id,
        version: newProfile.version,
        skinType: newProfile.skinType,
        sensitivityLevel: newProfile.sensitivityLevel,
      },
      updatedFields,
      needsPlanRebuild,
      planRegenerated,
      topic: {
        id: topic.id,
        title: topic.title,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? error.message || 'Internal server error'
      : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

