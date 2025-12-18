// app/api/admin/funnel/route.ts
// API для получения данных воронки конверсии

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { getCachedPlan } from '@/lib/cache';
import { INFO_SCREENS } from '@/app/(miniapp)/quiz/info-screens';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return false;
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (verifyError) {
      return false;
    }
  } catch (err) {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем всех пользователей
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Этап 1: Все пользователи (открыли мини-апп)
    const totalUsers = allUsers.length;

    // Этап 2: Пользователи, которые начали анкету (есть хотя бы один ответ)
    const usersWithAnswers = await prisma.userAnswer.groupBy({
      by: ['userId'],
    });
    const startedQuiz = usersWithAnswers.length;

    // Этап 3: Пользователи, которые завершили анкету (есть профиль кожи)
    const completedQuiz = await prisma.skinProfile.groupBy({
      by: ['userId'],
    });
    const completedQuizCount = completedQuiz.length;

    // Этап 4: Пользователи с планом (есть план в кэше или RecommendationSession)
    // Проверяем через RecommendationSession и профили для проверки кэша
    const usersWithSessions = await prisma.recommendationSession.groupBy({
      by: ['userId'],
    });
    
    // Также проверяем пользователей с профилями, у которых может быть план в кэше
    const usersWithProfiles = await prisma.skinProfile.findMany({
      select: {
        userId: true,
        version: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Для каждого пользователя проверяем наличие плана в кэше
    // Но это может быть медленно, поэтому делаем проверку только для пользователей без сессии
    const usersWithoutSession = usersWithProfiles
      .filter(p => !usersWithSessions.some(s => s.userId === p.userId))
      .slice(0, 100); // Ограничиваем проверку до 100 пользователей для производительности

    let additionalPlansCount = 0;
    for (const profile of usersWithoutSession) {
      const cachedPlan = await getCachedPlan(profile.userId, profile.version);
      if (cachedPlan && cachedPlan.plan28) {
        additionalPlansCount++;
      }
    }

    const hasPlan = usersWithSessions.length + additionalPlansCount;

    // Вычисляем конверсии
    const conversionToStarted = totalUsers > 0 ? (startedQuiz / totalUsers) * 100 : 0;
    const conversionToCompleted = startedQuiz > 0 ? (completedQuizCount / startedQuiz) * 100 : 0;
    const conversionToPlan = completedQuizCount > 0 ? (hasPlan / completedQuizCount) * 100 : 0;
    const overallConversion = totalUsers > 0 ? (hasPlan / totalUsers) * 100 : 0;

    // Данные по периодам (последние 7, 14, 30 дней)
    const now = new Date();
    const periods = [
      { name: '7 дней', days: 7 },
      { name: '14 дней', days: 14 },
      { name: '30 дней', days: 30 },
      { name: 'Все время', days: null },
    ];

    // Получаем дополнительные данные для подсчета по периодам
    const answersWithDates = await prisma.userAnswer.groupBy({
      by: ['userId'],
      _min: {
        createdAt: true,
      },
    });

    const profilesWithDates = await prisma.skinProfile.findMany({
      select: {
        userId: true,
        createdAt: true,
      },
    });

    const sessionsWithDates = await prisma.recommendationSession.findMany({
      select: {
        userId: true,
        createdAt: true,
      },
    });

    const periodData = periods.map(period => {
      const startDate = period.days ? new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000) : null;
      
      const periodUsers = startDate 
        ? allUsers.filter(u => new Date(u.createdAt) >= startDate).length
        : totalUsers;

      // Подсчитываем для периода
      const periodStarted = startDate
        ? answersWithDates.filter(a => {
            const firstAnswerDate = a._min.createdAt;
            return firstAnswerDate && new Date(firstAnswerDate) >= startDate;
          }).length
        : startedQuiz;

      const periodCompleted = startDate
        ? profilesWithDates.filter(p => new Date(p.createdAt) >= startDate).length
        : completedQuizCount;

      const periodPlan = startDate
        ? sessionsWithDates.filter(s => new Date(s.createdAt) >= startDate).length
        : hasPlan;

      return {
        period: period.name,
        users: periodUsers,
        started: periodStarted,
        completed: periodCompleted,
        hasPlan: periodPlan,
        conversionToStarted: periodUsers > 0 ? (periodStarted / periodUsers) * 100 : 0,
        conversionToCompleted: periodStarted > 0 ? (periodCompleted / periodStarted) * 100 : 0,
        conversionToPlan: periodCompleted > 0 ? (periodPlan / periodCompleted) * 100 : 0,
        overallConversion: periodUsers > 0 ? (periodPlan / periodUsers) * 100 : 0,
      };
    });

    // Вычисляем конверсию по экранам анкеты (41 экран)
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questions: {
          include: {
            answerOptions: true,
          },
          orderBy: [
            { groupId: 'asc' },
            { position: 'asc' },
          ],
        },
      },
    });

    const screenConversions: Array<{
      screenNumber: number;
      screenId: string;
      screenTitle: string;
      screenType: 'info' | 'question';
      reachedCount: number;
      conversion: number;
    }> = [];

    if (activeQuestionnaire) {
      // Строим полный список экранов (INFO_SCREENS + вопросы)
      const allScreens: Array<{
        id: string;
        title: string;
        type: 'info' | 'question';
        questionCode?: string;
        questionId?: number;
      }> = [];

      // Добавляем начальные инфо-экраны (без showAfterQuestionCode)
      const initialInfoScreens = INFO_SCREENS.filter(s => !s.showAfterQuestionCode);
      initialInfoScreens.forEach(screen => {
        allScreens.push({
          id: screen.id,
          title: screen.title,
          type: 'info',
        });
      });

      // Добавляем вопросы и инфо-экраны между ними в правильном порядке
      const questions = activeQuestionnaire.questions;
      const infoScreensMap = new Map<string, typeof INFO_SCREENS[0]>();
      INFO_SCREENS.forEach(screen => {
        if (screen.showAfterQuestionCode) {
          infoScreensMap.set(screen.showAfterQuestionCode, screen);
        }
      });

      // Проходим по вопросам и добавляем их вместе с инфо-экранами
      questions.forEach((question, index) => {
        // Добавляем вопрос
        allScreens.push({
          id: `question_${question.id}`,
          title: question.text,
          type: 'question',
          questionCode: question.code,
          questionId: question.id,
        });

        // Проверяем, есть ли инфо-экран после этого вопроса
        const infoScreen = infoScreensMap.get(question.code);
        if (infoScreen) {
          allScreens.push({
            id: infoScreen.id,
            title: infoScreen.title,
            type: 'info',
          });
        }
      });

      // Вычисляем конверсию для каждого экрана
      // Получаем всех пользователей, которые начали анкету
      const usersWhoStarted = await prisma.userAnswer.groupBy({
        by: ['userId'],
        _max: {
          createdAt: true,
        },
      });

      const userIdsWhoStarted = new Set(usersWhoStarted.map(u => u.userId));

      // Получаем все ответы пользователей для оптимизации
      const allAnswers = await prisma.userAnswer.findMany({
        where: {
          questionnaireId: activeQuestionnaire.id,
        },
        select: {
          userId: true,
          questionId: true,
        },
      });

      // Создаем карту: userId -> Set<questionId> (все вопросы, на которые ответил пользователь)
      const userAnswersMap = new Map<string, Set<number>>();
      allAnswers.forEach(answer => {
        if (!userAnswersMap.has(answer.userId)) {
          userAnswersMap.set(answer.userId, new Set());
        }
        userAnswersMap.get(answer.userId)!.add(answer.questionId);
      });

      // Для каждого экрана считаем, сколько пользователей до него дошли
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        let reachedCount = 0;

        if (screen.type === 'question' && screen.questionId) {
          // Для вопроса: считаем пользователей, которые ответили на этот вопрос
          const questionIndex = questions.findIndex(q => q.id === screen.questionId);
          if (questionIndex >= 0) {
            // Получаем все вопросы до текущего включительно
            const questionsUpToThis = questions.slice(0, questionIndex + 1);
            const questionIdsUpToThis = new Set(questionsUpToThis.map(q => q.id));

            // Считаем пользователей, которые ответили хотя бы на один вопрос до текущего включительно
            for (const [userId, answeredQuestionIds] of userAnswersMap.entries()) {
              // Проверяем, есть ли пересечение между отвеченными вопросами и вопросами до текущего
              const hasAnsweredUpToThis = Array.from(questionIdsUpToThis).some(qId => 
                answeredQuestionIds.has(qId)
              );
              if (hasAnsweredUpToThis) {
                reachedCount++;
              }
            }
          }
        } else if (screen.type === 'info') {
          // Для инфо-экрана: считаем пользователей, которые дошли до следующего вопроса
          // Если это начальный экран - считаем всех, кто начал анкету
          if (i === 0) {
            reachedCount = userIdsWhoStarted.size;
          } else {
            // Находим следующий вопрос после этого инфо-экрана
            let nextQuestionIndex = i + 1;
            while (nextQuestionIndex < allScreens.length && allScreens[nextQuestionIndex].type !== 'question') {
              nextQuestionIndex++;
            }

            if (nextQuestionIndex < allScreens.length) {
              const nextQuestion = allScreens[nextQuestionIndex];
              if (nextQuestion.questionId) {
                const questionIndex = questions.findIndex(q => q.id === nextQuestion.questionId);
                if (questionIndex >= 0) {
                  // Пользователь дошел до инфо-экрана, если он ответил на следующий вопрос
                  // или на любой вопрос до следующего включительно
                  const questionsUpToNext = questions.slice(0, questionIndex + 1);
                  const questionIdsUpToNext = new Set(questionsUpToNext.map(q => q.id));

                  for (const [userId, answeredQuestionIds] of userAnswersMap.entries()) {
                    const hasAnsweredUpToNext = Array.from(questionIdsUpToNext).some(qId => 
                      answeredQuestionIds.has(qId)
                    );
                    if (hasAnsweredUpToNext) {
                      reachedCount++;
                    }
                  }
                }
              }
            } else {
              // Если следующего вопроса нет (это последний экран), считаем всех, кто завершил анкету
              reachedCount = completedQuizCount;
            }
          }
        }

        const conversion = startedQuiz > 0 ? (reachedCount / startedQuiz) * 100 : 0;

        screenConversions.push({
          screenNumber: i + 1,
          screenId: screen.id,
          screenTitle: screen.title,
          screenType: screen.type,
          reachedCount,
          conversion,
        });
      }
    }

    return NextResponse.json({
      funnel: {
        totalUsers,
        startedQuiz,
        completedQuiz: completedQuizCount,
        hasPlan,
        conversionToStarted,
        conversionToCompleted,
        conversionToPlan,
        overallConversion,
      },
      periodData,
      screenConversions, // Конверсия по экранам анкеты
    });
  } catch (error: any) {
    console.error('Error fetching funnel data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

