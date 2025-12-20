// app/api/admin/funnel/route.ts
// API для получения данных воронки конверсии

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
// ИСПРАВЛЕНО (P0): Убран неиспользуемый импорт getCachedPlan (кэш-проверка удалена)
import { INFO_SCREENS } from '@/app/(miniapp)/quiz/info-screens';
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

    // ИСПРАВЛЕНО (P0): Получаем полную активную анкету для screenConversions
    // activeQuestionnaire.id уже получен выше, но здесь нужны questions
    const activeQuestionnaireWithQuestions = await prisma.questionnaire.findFirst({
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

    if (activeQuestionnaireWithQuestions) {
      // Строим полный список экранов (INFO_SCREENS + вопросы)
      const allScreens: Array<{
        id: string;
        title: string;
        type: 'info' | 'question';
        questionCode?: string;
        questionId?: number;
        showAfterQuestionCode?: string; // Для инфо-экранов: код вопроса, после которого показывается экран
      }> = [];

      // Добавляем начальные инфо-экраны (без showAfterQuestionCode)
      const initialInfoScreens = INFO_SCREENS.filter(s => !s.showAfterQuestionCode);
      initialInfoScreens.forEach(screen => {
        allScreens.push({
          id: screen.id,
          title: screen.title,
          type: 'info',
          showAfterQuestionCode: undefined,
        });
      });

      // Добавляем вопросы и инфо-экраны между ними в правильном порядке
      const questions = activeQuestionnaireWithQuestions.questions;
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
            showAfterQuestionCode: infoScreen.showAfterQuestionCode,
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

      // Для каждого экрана считаем, сколько пользователей до него дошли
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        let reachedCount = 0;

        // ИСПРАВЛЕНО (P0): screenConversions - правильная логика reached
        // Для question: reached = answered this questionId (не "хотя бы один до текущего")
        // Для info: reached = answered previous questionId (если есть предыдущий вопрос)
        if (screen.type === 'question' && screen.questionId) {
          // ИСПРАВЛЕНО (P0): Для вопроса считаем пользователей, которые ответили именно на этот вопрос
          // Раньше считалось "хотя бы один до текущего" → завышало метрику
          reachedCount = Array.from(userAnswersMap.values()).filter(
            answeredQuestionIds => answeredQuestionIds.has(screen.questionId!)
          ).length;
        } else if (screen.type === 'info') {
          // ИСПРАВЛЕНО: Для инфо-экрана правильная логика подсчета
          // Если это начальный экран (без showAfterQuestionCode) - считаем всех, кто начал анкету
          if (!screen.showAfterQuestionCode) {
            reachedCount = userIdsWhoStarted.size;
          } else {
            // Если инфо-экран показывается после вопроса (showAfterQuestionCode),
            // нужно найти вопрос с этим кодом и посчитать пользователей, которые на него ответили
            const targetQuestion = questions.find(q => q.code === screen.showAfterQuestionCode);
            if (targetQuestion) {
              // Считаем пользователей, которые ответили на вопрос, после которого показывается этот инфо-экран
              reachedCount = Array.from(userAnswersMap.values()).filter(
                answeredQuestionIds => answeredQuestionIds.has(targetQuestion.id)
              ).length;
            } else {
              // Если вопрос не найден, считаем всех, кто начал анкету (fallback)
              reachedCount = userIdsWhoStarted.size;
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

