// API для получения данных воронки конверсии

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
// ИСПРАВЛЕНО (P0): Убран неиспользуемый импорт getCachedPlan (кэш-проверка удалена)
import {
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

    // ИСПРАВЛЕНО: startedQuiz должен включать пользователей, которые открыли
    // анкету и дошли хотя бы до первого экрана, даже если они отвалились до
    // первого вопроса. Раньше брались только user_answers, поэтому ранние
    // отвалившиеся исчезали из знаменателя, а первые экраны выглядели как 100%.
    const usersWithAnswers = activeQuestionnaire
      ? await prisma.userAnswer.groupBy({
          by: ['userId'],
          where: { questionnaireId: activeQuestionnaire.id },
        })
      : [];

    let progressRows: Array<{
      userId: string;
      questionIndex: number;
      infoScreenIndex: number;
    }> = [];

    if (activeQuestionnaire) {
      try {
        progressRows = await prisma.questionnaireProgress.findMany({
          where: { questionnaireId: activeQuestionnaire.id },
          select: {
            userId: true,
            questionIndex: true,
            infoScreenIndex: true,
          },
        });
      } catch (progressErr: any) {
        // Старые окружения могли жить без questionnaire_progress. В этом случае
        // оставляем прежний fallback по ответам, чтобы весь роут не падал.
        if (
          progressErr?.code !== 'P2021' &&
          !progressErr?.message?.includes('does not exist')
        ) {
          throw progressErr;
        }
      }
    }

    const startedSet = new Set<string>([
      ...usersWithAnswers.map((u) => u.userId),
      ...progressRows.map((row) => row.userId),
    ]);

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

      // «Дошёл до экрана N» = самый дальний экран пользователя >= N. Источники:
      // 1) questionnaire_progress для тех, кто отвалился до первого ответа;
      // 2) user_answers для восстановленного/завершённого пути;
      // 3) завершённая анкета/план как гарантия достижения финального экрана.
      const screenIndexByQuestionId = new Map<number, number>();
      const lastInfoScreenIndexByQuestionId = new Map<number, number>();
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        if (screen.type === 'question' && screen.questionId) {
          screenIndexByQuestionId.set(screen.questionId, i);
        }
        if (screen.triggerQuestionId != null) {
          lastInfoScreenIndexByQuestionId.set(screen.triggerQuestionId, i);
        }
      }

      const screenIndexByQuestionOrder = questionsInAppOrder.map(
        (q: { id: number }) => screenIndexByQuestionId.get(q.id)
      );

      // Тянем только пары (userId, questionId) активной анкеты.
      const answerRows = await prisma.userAnswer.findMany({
        where: { questionnaireId: activeQuestionnaireWithQuestions.id },
        select: { userId: true, questionId: true },
      });

      // Для каждого пользователя — индекс самого дальнего достигнутого экрана.
      const furthestScreenByUser = new Map<string, number>();
      const usersWithPreciseScreenProgress = new Set<string>();
      const setFurthestScreen = (userId: string, screenIndex: number | undefined) => {
        if (screenIndex === undefined || Number.isNaN(screenIndex)) return;
        const clamped = Math.max(0, Math.min(screenIndex, allScreens.length - 1));
        const prev = furthestScreenByUser.get(userId);
        if (prev === undefined || clamped > prev) {
          furthestScreenByUser.set(userId, clamped);
        }
      };

      for (const row of progressRows) {
        if (row.questionIndex <= 0 && row.infoScreenIndex < initialInfoScreens.length) {
          setFurthestScreen(row.userId, row.infoScreenIndex);
          continue;
        }

        // Новые клиенты сохраняют infoScreenIndex как абсолютный индекс экрана
        // всей анкеты. Значение === initialInfoScreens.length оставляем
        // совместимым со старым форматом: «начальные экраны пройдены».
        if (
          row.infoScreenIndex > initialInfoScreens.length &&
          row.infoScreenIndex < allScreens.length
        ) {
          usersWithPreciseScreenProgress.add(row.userId);
          setFurthestScreen(row.userId, row.infoScreenIndex);
          continue;
        }

        const safeQuestionIndex = Math.min(
          Math.max(0, row.questionIndex),
          questionsInAppOrder.length - 1
        );
        const questionScreenIndex =
          screenIndexByQuestionOrder[safeQuestionIndex];
        setFurthestScreen(row.userId, questionScreenIndex);
      }

      for (const row of answerRows) {
        const questionScreenIndex = screenIndexByQuestionId.get(row.questionId);
        const followingInfoScreenIndex = lastInfoScreenIndexByQuestionId.get(row.questionId);
        setFurthestScreen(
          row.userId,
          usersWithPreciseScreenProgress.has(row.userId)
            ? questionScreenIndex
            : (followingInfoScreenIndex ?? questionScreenIndex)
        );
      }

      for (const userId of completedSet) {
        setFurthestScreen(userId, allScreens.length - 1);
      }
      for (const userId of planSet) {
        setFurthestScreen(userId, allScreens.length - 1);
      }

      // Если пользователь попал в стартовую когорту только по факту ответа/профиля,
      // но его конкретную позицию не удалось восстановить, считаем, что он дошёл
      // хотя бы до первого экрана.
      for (const userId of startedSet) {
        setFurthestScreen(userId, 0);
      }

      // reachedAt[p] = сколько пользователей дошли до экрана p.
      const reachedAt = new Array<number>(allScreens.length).fill(0);
      const atFurthest = new Array<number>(allScreens.length).fill(0);
      for (const idx of furthestScreenByUser.values()) atFurthest[idx]++;
      let runningReached = 0;
      for (let p = allScreens.length - 1; p >= 0; p--) {
        runningReached += atFurthest[p];
        reachedAt[p] = runningReached;
      }

      // Для каждого экрана считаем, сколько пользователей до него дошли (в том же порядке, что и в приложении)
      for (let i = 0; i < allScreens.length; i++) {
        const screen = allScreens[i];
        const reachedCount = reachedAt[i] || 0;

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
