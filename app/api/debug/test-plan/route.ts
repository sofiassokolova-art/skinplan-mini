// app/api/debug/test-plan/route.ts
// Отладочный endpoint для проверки генерации плана

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', step: 'token_check' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token', step: 'token_verification' },
        { status: 401 }
      );
    }

    // Проверяем каждый шаг
    const checks: Record<string, any> = {
      userId,
      hasProfile: false,
      hasRecommendationSession: false,
      hasProducts: false,
      profile: null,
      recommendationSession: null,
      productsCount: 0,
    };

    // 1. Проверяем профиль
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    checks.hasProfile = !!profile;
    checks.profile = profile ? {
      id: profile.id,
      skinType: profile.skinType,
      version: profile.version,
    } : null;

    if (!profile) {
      return NextResponse.json({
        error: 'No profile found',
        step: 'profile_check',
        checks,
      }, { status: 404 });
    }

    // 2. Проверяем RecommendationSession
    const recommendationSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    checks.hasRecommendationSession = !!recommendationSession;
    checks.recommendationSession = recommendationSession ? {
      id: recommendationSession.id,
      productIds: recommendationSession.products,
    } : null;

    // 3. Проверяем продукты
    const products = await prisma.product.findMany({
      where: { status: 'published' },
      take: 10,
    });

    checks.hasProducts = products.length > 0;
    checks.productsCount = products.length;

    // Определяем статус
    let status = 'ok';
    let message = 'Все проверки пройдены. План должен генерироваться.';
    
    if (!checks.hasProfile) {
      status = 'error';
      message = 'Профиль не найден. Пройдите анкету сначала.';
    } else if (!checks.hasRecommendationSession) {
      status = 'warning';
      message = 'RecommendationSession не найден, но будет создан автоматически при генерации плана.';
    } else if (!checks.hasProducts) {
      status = 'error';
      message = 'Продукты не найдены в базе данных. Добавьте продукты через админ-панель.';
    }

    return NextResponse.json({
      success: status === 'ok',
      status,
      checks,
      message,
    });
  } catch (error: any) {
    console.error('Test plan error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

