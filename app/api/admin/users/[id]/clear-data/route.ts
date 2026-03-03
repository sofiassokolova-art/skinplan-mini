// app/api/admin/users/[id]/clear-data/route.ts
// Полная очистка данных пользователя админом (БД + кэш)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateAllUserCache } from '@/lib/cache';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Проверяем, что пользователь существует
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const results = {
      recommendationSessions: 0,
      planProgress: 0,
      userAnswers: 0,
      skinProfiles: 0,
      planFeedback: 0,
      wishlist: 0,
      cart: 0,
      plan28: 0,
      clientLogs: 0,
      questionnaireProgress: 0,
      userPreferencesReset: false,
      cacheCleared: false,
      tagsCleared: false,
    };

    // 1. Очищаем кэш пользователя (все версии)
    try {
      await invalidateAllUserCache(userId);
      results.cacheCleared = true;
    } catch {
      // Кэш не критичен, продолжаем
    }

    // 2. Удаляем данные из БД
    // 2.1 RecommendationSession
    results.recommendationSessions = (
      await prisma.recommendationSession.deleteMany({ where: { userId } })
    ).count;

    // 2.2 PlanProgress
    try {
      results.planProgress = (
        await prisma.planProgress.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // возможный рассинхрон схемы — не критично
    }

    // 2.3 UserAnswer (анкета)
    results.userAnswers = (
      await prisma.userAnswer.deleteMany({ where: { userId } })
    ).count;

    // 2.4 SkinProfile
    results.skinProfiles = (
      await prisma.skinProfile.deleteMany({ where: { userId } })
    ).count;

    // 2.5 PlanFeedback
    try {
      results.planFeedback = (
        await prisma.planFeedback.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // не критично
    }

    // 2.6 Wishlist
    try {
      results.wishlist = (
        await prisma.wishlist.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // не критично
    }

    // 2.7 Cart
    try {
      results.cart = (
        await prisma.cart.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // не критично
    }

    // 2.8 Plan28
    try {
      results.plan28 = (
        await prisma.plan28.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // не критично
    }

    // 2.9 ClientLog
    try {
      results.clientLogs = (
        await prisma.clientLog.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // не критично
    }

    // 2.10 QuestionnaireProgress (прогресс анкеты)
    try {
      results.questionnaireProgress = (
        await prisma.questionnaireProgress.deleteMany({ where: { userId } })
      ).count;
    } catch {
      // если таблицы нет — пропускаем
    }

    // 3. Сбрасываем preferences (флаги ретейка и т.п.)
    try {
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (prefs) {
        await prisma.userPreferences.update({
          where: { userId },
          data: {
            hasPlanProgress: false,
            isRetakingQuiz: false,
            fullRetakeFromHome: false,
            paymentRetakingCompleted: false,
            paymentFullRetakeCompleted: false,
            extra: {},
          },
        });
        results.userPreferencesReset = true;
      }
    } catch {
      // не критично
    }

    // 4. Очищаем теги пользователя (включая флаги оплаты)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tags: {
            set: [],
          },
        },
        select: { id: true },
      });
      results.tagsCleared = true;
    } catch {
      // не критично
    }

    return NextResponse.json({
      success: true,
      message: 'User data cleared successfully',
      results,
    });
  } catch (error: any) {
    console.error('Error clearing user data (admin):', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

