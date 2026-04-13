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

    try {
      await invalidateAllUserCache(userId);
      results.cacheCleared = true;
    } catch {
      // cache is not critical
    }

    // All table deletes run in parallel; allSettled so one failure doesn't abort others
    const [
      recSessions,
      planProgress,
      userAnswers,
      skinProfiles,
      planFeedback,
      wishlist,
      cart,
      plan28,
      clientLogs,
      questionnaireProgress,
    ] = await Promise.allSettled([
      prisma.recommendationSession.deleteMany({ where: { userId } }),
      prisma.planProgress.deleteMany({ where: { userId } }),
      prisma.userAnswer.deleteMany({ where: { userId } }),
      prisma.skinProfile.deleteMany({ where: { userId } }),
      prisma.planFeedback.deleteMany({ where: { userId } }),
      prisma.wishlist.deleteMany({ where: { userId } }),
      prisma.cart.deleteMany({ where: { userId } }),
      prisma.plan28.deleteMany({ where: { userId } }),
      prisma.clientLog.deleteMany({ where: { userId } }),
      prisma.questionnaireProgress.deleteMany({ where: { userId } }),
    ]);

    results.recommendationSessions = recSessions.status === 'fulfilled' ? recSessions.value.count : 0;
    results.planProgress = planProgress.status === 'fulfilled' ? planProgress.value.count : 0;
    results.userAnswers = userAnswers.status === 'fulfilled' ? userAnswers.value.count : 0;
    results.skinProfiles = skinProfiles.status === 'fulfilled' ? skinProfiles.value.count : 0;
    results.planFeedback = planFeedback.status === 'fulfilled' ? planFeedback.value.count : 0;
    results.wishlist = wishlist.status === 'fulfilled' ? wishlist.value.count : 0;
    results.cart = cart.status === 'fulfilled' ? cart.value.count : 0;
    results.plan28 = plan28.status === 'fulfilled' ? plan28.value.count : 0;
    results.clientLogs = clientLogs.status === 'fulfilled' ? clientLogs.value.count : 0;
    results.questionnaireProgress = questionnaireProgress.status === 'fulfilled' ? questionnaireProgress.value.count : 0;

    try {
      const { count } = await prisma.userPreferences.updateMany({
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
      results.userPreferencesReset = count > 0;
    } catch {
      // not critical
    }

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

