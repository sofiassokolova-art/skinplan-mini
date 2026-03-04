// app/api/admin/funnel/route.ts
// API для получения данных воронки конверсии

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
// ИСПРАВЛЕНО (P0): Убран неиспользуемый импорт getCachedPlan (кэш-проверка удалена)
import {
  INFO_SCREENS,
  getInitialInfoScreens,
  getInfoScreenAfterQuestion,
  walkInfoScreenChain,
} from '@/app/(miniapp)/quiz/info-screens';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ИСПРАВЛЕНО (P0): Получаем активную анкету в начале для фильтрации метрик
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    // ИСПРАВЛЕНО (P0): user.count() вместо findMany для производительности
    const totalUsers = await prisma.user.count();

    // ИСПРАВЛЕНО (P0): startedQuiz фильтруется по activeQuestionnaire.id
    // Раньше считались ответы на любую анкету/версию/тест
    const usersWithAnswers = activeQuestionnaire
      ? await prisma.userAnswer.groupBy({
          by: ['userId'],
          where: { questionnaireId: activeQuestionnaire.id },
        })
      : [];
    const startedQuiz = usersWithAnswers.length;

    // Этап 3: Пользователи, которые завершили анкету (есть профиль кожи)
    const completedQuiz = await prisma.skinProfile.groupBy({
      by: ['userId'],
    });
    const completedQuizCount = completedQuiz.length;

    // ИСПРАВЛЕНО (P0): hasPlan считается только по БД-факту (RecommendationSession)
    // Убрана кэш-проверка, т.к. она проверяла только 100 пользователей и делала метрику невалидной
    // Если нужна точная метрика - план должен быть материализован в БД (Plan28 table)
    const usersWithSessions = await prisma.recommendationSession.groupBy({
      by: ['userId'],
    });
    
    const hasPlan = usersWithSessions.length;

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

    // ИСПРАВЛЕНО (P0): Периодные метрики считают уникальных пользователей через groupBy с where
    // Раньше считались записи (профили/сессии), а не уникальные пользователи
    const periodData = await Promise.all(periods.map(async (period) => {
      const startDate = period.days ? new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000) : null;
      
      // ИСПРАВЛЕНО (P0): user.count() с where вместо findMany + filter
      const periodUsers = startDate
        ? await prisma.user.count({
            where: { createdAt: { gte: startDate } },
          })
        : totalUsers;

      // ИСПРАВЛЕНО (P0): Считаем уникальных пользователей через groupBy с where
      const periodStarted = startDate && activeQuestionnaire
        ? (await prisma.userAnswer.groupBy({
            by: ['userId'],
            where: {
              questionnaireId: activeQuestionnaire.id,
              createdAt: { gte: startDate },
            },
          })).length
        : startedQuiz;

      // ИСПРАВЛЕНО (P0): Считаем уникальных пользователей, а не записи профилей
      const periodCompleted = startDate
        ? (await prisma.skinProfile.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: startDate } },
          })).length
        : completedQuizCount;

      // ИСПРАВЛЕНО (P0): Считаем уникальных пользователей, а не записи сессий
      const periodPlan = startDate
        ? (await prisma.recommendationSession.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: startDate } },
          })).length
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
    }));

    // ИСПРАВЛЕНО (P0): Получаем полную активную анкету для screenConversions (порядок экранов как в приложении)
    const activeQuestionnaireWithQuestions = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: { include: { answerOptions: true } },
          },
        },
        questions: {
          include: { answerOptions: true },
          orderBy: [{ groupId: 'asc' }, { position: 'asc' }],
        },
      },
    });

    const screenConversions: Array<{
      screenNumber: number;
      screenId: string;
      screenTitle: string;
      screenType: 'info' | 'question';
      reachedCount: number;
      conversionFromPrev: number;
      conversionFromStart: number;
    }> = [];

    if (activeQuestionnaireWithQuestions) {
      // Порядок экранов как в приложении: getInitialInfoScreens + extractQuestions + цепочки инфо после вопросов
      const allScreens: Array<{
        id: string;
        title: string;
        type: 'info' | 'question';
        questionCode?: string;
        questionId?: number;
        showAfterQuestionCode?: string;
        triggerQuestionId?: number; // для инфо после вопроса: вопрос, после которого показывается экран
      }> = [];

      const initialInfoScreens = getInitialInfoScreens();
      initialInfoScreens.forEach(screen => {
        allScreens.push({
          id: screen.id,
          title: screen.title,
          type: 'info',
          showAfterQuestionCode: undefined,
        });
      });

      const questionnaireShape = {
        ...activeQuestionnaireWithQuestions,
        groups: activeQuestionnaireWithQuestions.questionGroups,
      };
      const questionsInAppOrder = extractQuestionsFromQuestionnaire(questionnaireShape);

      questionsInAppOrder.forEach((question: { id: number; code?: string; text?: string }) => {
        allScreens.push({
          id: `question_${question.id}`,
          title: question.text ?? '',
          type: 'question',
          questionCode: question.code,
          questionId: question.id,
        });

        const firstInfoAfterQuestion = question.code
          ? getInfoScreenAfterQuestion(question.code)
          : undefined;
        if (firstInfoAfterQuestion) {
          const chain = walkInfoScreenChain(firstInfoAfterQuestion);
          chain.forEach((infoScreen) => {
            allScreens.push({
              id: infoScreen.id,
              title: infoScreen.title,
              type: 'info',
              showAfterQuestionCode: infoScreen.showAfterQuestionCode,
              triggerQuestionId: question.id,
            });
          });
        }
      });

      // Вычисляем конверсию для каждого экрана
      // ИСПРАВЛЕНО (P0): Получаем всех пользователей, которые начали активную анкету
      const usersWhoStarted = await prisma.userAnswer.groupBy({
        by: ['userId'],
        where: {
          questionnaireId: activeQuestionnaireWithQuestions.id,
        },
      });

      const userIdsWhoStarted = new Set(usersWhoStarted.map(u => u.userId));

      // ИСПРАВЛЕНО (P0): Получаем все ответы пользователей для активной анкеты
      const allAnswers = await prisma.userAnswer.findMany({
        where: {
          questionnaireId: activeQuestionnaireWithQuestions.id,
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

      // Для каждого экрана считаем, сколько пользователей до него дошли (в том же порядке, что и в приложении)
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        let reachedCount = 0;

        if (screen.type === 'question' && screen.questionId) {
          reachedCount = Array.from(userAnswersMap.values()).filter(
            answeredQuestionIds => answeredQuestionIds.has(screen.questionId!)
          ).length;
        } else if (screen.type === 'info') {
          if (screen.triggerQuestionId != null) {
            reachedCount = Array.from(userAnswersMap.values()).filter(
              answeredQuestionIds => answeredQuestionIds.has(screen.triggerQuestionId!)
            ).length;
          } else {
            reachedCount = userIdsWhoStarted.size;
          }
        }

        screenConversions.push({
          screenNumber: i + 1,
          screenId: screen.id,
          screenTitle: screen.title,
          screenType: screen.type,
          reachedCount,
          conversionFromPrev: 0,
          conversionFromStart: 0,
        });
      }

      // Конверсии: от начала и от предыдущего экрана; конверсия от предыдущего не больше 100%
      let previousReached = startedQuiz;
      for (let i = 0; i < screenConversions.length; i++) {
        const current = screenConversions[i];
        const baseForPrev =
          i === 0 ? startedQuiz : previousReached;

        current.conversionFromStart =
          startedQuiz > 0 ? (current.reachedCount / startedQuiz) * 100 : 0;
        current.conversionFromPrev =
          baseForPrev > 0
            ? Math.min(100, (current.reachedCount / baseForPrev) * 100)
            : 0;

        previousReached = current.reachedCount;
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

