// app/api/admin/users/[id]/plan/route.ts
// API для получения плана пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - получение плана пользователя
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.id;

    // Получаем профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { version: true, id: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'User has no skin profile' },
        { status: 404 }
      );
    }

    // ИСПРАВЛЕНО: Сначала проверяем Plan28 в БД (основной источник)
    const plan28Record = await prisma.plan28.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        planData: true,
        profileVersion: true,
        createdAt: true,
      },
    });

    if (plan28Record && plan28Record.planData) {
      // Преобразуем Plan28 из БД в формат для админки
      const planData = plan28Record.planData as any;
      
      // Извлекаем все уникальные продукты из дней плана
      const allProducts: any[] = [];
      const productMap = new Map<number, any>();
      
      if (planData?.days && Array.isArray(planData.days)) {
        planData.days.forEach((day: any) => {
          if (day.steps && Array.isArray(day.steps)) {
            day.steps.forEach((step: any) => {
              if (step.product && !productMap.has(step.product.id)) {
                productMap.set(step.product.id, step.product);
                allProducts.push(step.product);
              }
            });
          }
        });
      }
      
      // Извлекаем недели из плана
      const weeks = planData?.weeks || [];
      
      // Получаем информацию о профиле для отображения
      const fullProfile = await prisma.skinProfile.findUnique({
        where: { id: profile.id },
        select: {
          skinType: true,
          ageGroup: true,
          notes: true,
          medicalMarkers: true, // mainGoals / маркеры из профиля
        },
      });
      
      // Источник истины для целей:
      // 1) mainGoals из самого плана (planData.mainGoals)
      // 2) fallback — mainGoals из medicalMarkers в профиле, если по каким‑то причинам в плане нет mainGoals
      const planMainGoals = Array.isArray(planData?.mainGoals) ? planData.mainGoals : [];
      const medicalMarkers = fullProfile?.medicalMarkers as any;
      const markersMainGoals = Array.isArray(medicalMarkers?.mainGoals) ? medicalMarkers.mainGoals : [];
      const mainGoals = planMainGoals.length > 0 ? planMainGoals : markersMainGoals;
      
      return NextResponse.json({
        plan: {
          plan28: planData,
          profile: {
            version: plan28Record.profileVersion,
            skinType: fullProfile?.skinType || null,
            primaryFocus: mainGoals.length > 0 ? mainGoals[0] : null,
            ageGroup: fullProfile?.ageGroup || null,
            concerns: mainGoals,
          },
          products: allProducts,
          weeks: weeks,
          warnings: [],
        },
      });
    }

    // Если план не найден в БД, проверяем кэш для текущей версии
    let cachedPlan = await getCachedPlan(userId, profile.version);
    
    if (cachedPlan && cachedPlan.plan28) {
      return NextResponse.json({ plan: cachedPlan });
    }

    // Если план не найден для текущей версии, проверяем предыдущие версии профиля
    const previousProfiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5, // Увеличиваем количество проверяемых версий
      select: { version: true },
    });

    const previousVersions = previousProfiles.filter(p => p.version !== profile.version);
    const cacheChecks = previousVersions.map(prevProfile => getCachedPlan(userId, prevProfile.version));
    const cachedPlans = await Promise.all(cacheChecks);
    
    for (let i = 0; i < cachedPlans.length; i++) {
      const prevCachedPlan = cachedPlans[i];
      if (prevCachedPlan && prevCachedPlan.plan28) {
        // Возвращаем план из предыдущей версии - он все еще валиден
        return NextResponse.json({ plan: prevCachedPlan });
      }
    }

    // Если плана нет ни в БД, ни в кэше, возвращаем сообщение
    return NextResponse.json(
      { error: 'Plan not found. User may need to generate a new plan.' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching user plan:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

