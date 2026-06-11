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
import { adminCache } from '@/lib/admin-cache';

// Тяжёлый агрегирующий роут (тянет все ответы анкеты + агрегаты). Даём запас по
// времени и кэшируем результат, иначе функция убивается дефолтным лимитом Vercel
// → фронт получает пустой ответ и график/воронка «не отображаются».
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Кэш на 2 минуты — повторные открытия страницы мгновенные
    const cachedFunnel = adminCache.get<any>('admin_funnel');
    if (cachedFunnel) {
      return NextResponse.json(cachedFunnel);
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
    const startedSet = new Set(usersWithAnswers.map((u) => u.userId));

    // ИСПРАВЛЕНО (#1): Воронка строится как ВЛОЖЕННЫЕ подмножества, чтобы каждый
    // следующий этап был подмножеством предыдущего (конверсия не может быть > 100%).
    // Раньше completedQuiz/hasPlan считались по ВСЕМ профилям/сессиям (в т.ч. со
    // старых версий анкеты), из-за чего конверсии этапов превышали 100%.
    const profileGroups = await prisma.skinProfile.groupBy({ by: ['userId'] });
    const profileSet = new Set(profileGroups.map((g) => g.userId));

    const sessionGroups = await prisma.recommendationSession.groupBy({ by: ['userId'] });
    const sessionSet = new Set(sessionGroups.map((g) => g.userId));

    // Завершившие = из начавших те, у кого есть профиль кожи
    const completedSet = new Set([...startedSet].filter((id) => profileSet.has(id)));
    // Получившие план = из завершивших те, у кого есть рекомендательная сессия
    const planSet = new Set([...completedSet].filter((id) => sessionSet.has(id)));

    const startedQuiz = startedSet.size;
    const completedQuizCount = completedSet.size;
    const hasPlan = planSet.size;

    // Конверсии с clamp на [0,100] как страховка от деления несогласованных метрик
    const pct = (num: number, den: number) =>
      den > 0 ? Math.min(100, (num / den) * 100) : 0;
    const conversionToStarted = pct(startedQuiz, totalUsers);
    const conversionToCompleted = pct(completedQuizCount, startedQuiz);
    const conversionToPlan = pct(hasPlan, completedQuizCount);
    const overallConversion = pct(hasPlan, totalUsers);

    // Данные по периодам (последние 7, 14, 30 дней)
    const now = new Date();
    const periods = [
      { name: '7 дней', days: 7 },
      { name: '14 дней', days: 14 },
      { name: '30 дней', days: 30 },
      { name: 'Все время', days: null },
    ];

    // ИСПРАВЛЕНО (#2): Периодная воронка строится по ЕДИНОЙ когорте — дате
    // РЕГИСТРАЦИИ пользователя. Берём зарегистрированных в окне и пересекаем их
    // с этапными множествами воронки. Раньше знаменатель (periodUsers) считался
    // по дате регистрации, а числители (started/completed/plan) — по дате
    // активности, из-за чего конверсия могла превышать 100% (пользователь
    // зарегистрировался давно, но прошёл анкету недавно).
    const periodData = await Promise.all(periods.map(async (period) => {
      if (!period.days) {
        // «Всё время» — используем уже посчитанные глобальные значения
        return {
          period: period.name,
          users: totalUsers,
          started: startedQuiz,
          completed: completedQuizCount,
          hasPlan,
          conversionToStarted,
          conversionToCompleted,
          conversionToPlan,
          overallConversion,
        };
      }

      const startDate = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000);

      const periodUsers = await prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true },
      });
      const periodUserSet = new Set(periodUsers.map((u) => u.id));

      const periodUsersCount = periodUserSet.size;
      const periodStarted = [...startedSet].filter((id) => periodUserSet.has(id)).length;
      const periodCompleted = [...completedSet].filter((id) => periodUserSet.has(id)).length;
      const periodPlan = [...planSet].filter((id) => periodUserSet.has(id)).length;

      return {
        period: period.name,
        users: periodUsersCount,
        started: periodStarted,
        completed: periodCompleted,
        hasPlan: periodPlan,
        conversionToStarted: pct(periodStarted, periodUsersCount),
        conversionToCompleted: pct(periodCompleted, periodStarted),
        conversionToPlan: pct(periodPlan, periodCompleted),
        overallConversion: pct(periodPlan, periodUsersCount),
      };
    }));

    const screenConversions: Array<{
      screenNumber: number;
      screenId: string;
      screenTitle: string;
      screenType: 'info' | 'question';
      reachedCount: number;
      conversionFromPrev: number;
      conversionFromStart: number;
    }> = [];

    // Секция конверсии по экранам зависит от quiz info-screens и тянет ВСЕ ответы
    // активной анкеты — изолируем в try/catch, чтобы её сбой или тяжесть не
    // обрушивали весь ответ воронки (основные метрики важнее экранного разреза).
    try {
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

      // ИСПРАВЛЕНО (перф): сколько уникальных пользователей дошли до каждого вопроса.
      // Благодаря @@unique([userId, questionnaireId, questionId]) одна строка =
      // один пользователь, поэтому _count строк по questionId = число дошедших.
      // Раньше тянули в память ВСЕ ответы анкеты (findMany) и строили карты в JS —
      // на больших данных это валило роут по таймауту, и график не отображался.
      const reachedGroups = await prisma.userAnswer.groupBy({
        by: ['questionId'],
        where: {
          questionnaireId: activeQuestionnaireWithQuestions.id,
        },
        _count: { userId: true },
      });
      const reachedByQuestion = new Map<number, number>(
        reachedGroups.map((g) => [g.questionId, g._count.userId])
      );

      // Для каждого экрана считаем, сколько пользователей до него дошли (в том же порядке, что и в приложении)
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        let reachedCount = 0;

        if (screen.type === 'question' && screen.questionId) {
          reachedCount = reachedByQuestion.get(screen.questionId) || 0;
        } else if (screen.type === 'info') {
          if (screen.triggerQuestionId != null) {
            reachedCount = reachedByQuestion.get(screen.triggerQuestionId) || 0;
          } else {
            // Начальные инфо-экраны: все, кто начал активную анкету
            reachedCount = startedQuiz;
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
    } catch (screenErr: any) {
      console.error(
        'Funnel screenConversions failed; возвращаем воронку без разреза по экранам:',
        screenErr?.message || screenErr
      );
    }

    const responseData = {
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
    };
    adminCache.set('admin_funnel', responseData, 120);
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error fetching funnel data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

