// app/api/user/preferences/route.ts
// API для работы с пользовательскими настройками и флагами
// Заменяет использование localStorage

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

// GET - получение настроек пользователя
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/user/preferences';
  let userId: string | null = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // Получаем или создаем настройки пользователя
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });







    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      isRetakingQuiz: preferences.isRetakingQuiz,
      fullRetakeFromHome: preferences.fullRetakeFromHome,
      paymentRetakingCompleted: preferences.paymentRetakingCompleted,
      paymentFullRetakeCompleted: preferences.paymentFullRetakeCompleted,
      hasPlanProgress: preferences.hasPlanProgress,
      routineProducts: preferences.routineProducts,
      planFeedbackSent: preferences.planFeedbackSent,
      serviceFeedbackSent: preferences.serviceFeedbackSent,
      lastPlanFeedbackDate: preferences.lastPlanFeedbackDate?.toISOString() || null,
      lastServiceFeedbackDate: preferences.lastServiceFeedbackDate?.toISOString() || null,
      extra: preferences.extra,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - обновление настроек пользователя
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/user/preferences';
  let userId: string | null = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const body = await request.json();
    const {
      isRetakingQuiz,
      fullRetakeFromHome,
      paymentRetakingCompleted,
      paymentFullRetakeCompleted,
      hasPlanProgress,
      routineProducts,
      planFeedbackSent,
      serviceFeedbackSent,
      lastPlanFeedbackDate,
      lastServiceFeedbackDate,
      extra,
    } = body;

    // Подготавливаем данные для обновления
    const updateData: any = {};
    
    if (typeof isRetakingQuiz === 'boolean') {
      updateData.isRetakingQuiz = isRetakingQuiz;
    }
    if (typeof fullRetakeFromHome === 'boolean') {
      updateData.fullRetakeFromHome = fullRetakeFromHome;
    }
    if (typeof paymentRetakingCompleted === 'boolean') {
      updateData.paymentRetakingCompleted = paymentRetakingCompleted;
    }
    if (typeof paymentFullRetakeCompleted === 'boolean') {
      updateData.paymentFullRetakeCompleted = paymentFullRetakeCompleted;
    }
    if (typeof hasPlanProgress === 'boolean') {
      updateData.hasPlanProgress = hasPlanProgress;
    }
    if (routineProducts !== undefined) {
      updateData.routineProducts = routineProducts;
    }
    if (typeof planFeedbackSent === 'boolean') {
      updateData.planFeedbackSent = planFeedbackSent;
    }
    if (typeof serviceFeedbackSent === 'boolean') {
      updateData.serviceFeedbackSent = serviceFeedbackSent;
    }
    if (lastPlanFeedbackDate !== undefined) {
      updateData.lastPlanFeedbackDate = lastPlanFeedbackDate 
        ? new Date(lastPlanFeedbackDate) 
        : null;
    }
    if (lastServiceFeedbackDate !== undefined) {
      updateData.lastServiceFeedbackDate = lastServiceFeedbackDate 
        ? new Date(lastServiceFeedbackDate) 
        : null;
    }
    if (extra !== undefined) {
      updateData.extra = extra;
    }

    // Обновляем или создаем настройки
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      success: true,
      preferences: {
        isRetakingQuiz: preferences.isRetakingQuiz,
        fullRetakeFromHome: preferences.fullRetakeFromHome,
        paymentRetakingCompleted: preferences.paymentRetakingCompleted,
        paymentFullRetakeCompleted: preferences.paymentFullRetakeCompleted,
        hasPlanProgress: preferences.hasPlanProgress,
        routineProducts: preferences.routineProducts,
        planFeedbackSent: preferences.planFeedbackSent,
        serviceFeedbackSent: preferences.serviceFeedbackSent,
        lastPlanFeedbackDate: preferences.lastPlanFeedbackDate?.toISOString() || null,
        lastServiceFeedbackDate: preferences.lastServiceFeedbackDate?.toISOString() || null,
        extra: preferences.extra,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удаление конкретного флага/настройки
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const method = 'DELETE';
  const path = '/api/user/preferences';
  let userId: string | null = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Missing key parameter' },
        { status: 400 }
      );
    }

    // Получаем текущие настройки
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return NextResponse.json(
        { error: 'Preferences not found' },
        { status: 404 }
      );
    }

    // Сбрасываем указанный флаг в значение по умолчанию
    const updateData: any = {};
    
    switch (key) {
      case 'isRetakingQuiz':
        updateData.isRetakingQuiz = false;
        break;
      case 'fullRetakeFromHome':
        updateData.fullRetakeFromHome = false;
        break;
      case 'paymentRetakingCompleted':
        updateData.paymentRetakingCompleted = false;
        break;
      case 'paymentFullRetakeCompleted':
        updateData.paymentFullRetakeCompleted = false;
        break;
      case 'hasPlanProgress':
        updateData.hasPlanProgress = false;
        break;
      case 'routineProducts':
        updateData.routineProducts = null;
        break;
      case 'planFeedbackSent':
        updateData.planFeedbackSent = false;
        break;
      case 'serviceFeedbackSent':
        updateData.serviceFeedbackSent = false;
        break;
      case 'lastPlanFeedbackDate':
        updateData.lastPlanFeedbackDate = null;
        break;
      case 'lastServiceFeedbackDate':
        updateData.lastServiceFeedbackDate = null;
        break;
      default:
        return NextResponse.json(
          { error: `Unknown key: ${key}` },
          { status: 400 }
        );
    }

    await prisma.userPreferences.update({
      where: { userId },
      data: updateData,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

