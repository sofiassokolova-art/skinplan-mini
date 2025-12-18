// app/api/admin/users/[id]/plan/route.ts
// API для получения плана пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('admin_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return false;
    }

    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}

// GET - получение плана пользователя
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const isAdmin = await verifyAdmin(request);
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
      select: { version: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'User has no skin profile' },
        { status: 404 }
      );
    }

    // Пытаемся получить план из кэша для текущей версии
    let cachedPlan = await getCachedPlan(userId, profile.version);
    
    if (cachedPlan && cachedPlan.plan28) {
      return NextResponse.json({ plan: cachedPlan });
    }

    // Если план не найден для текущей версии, проверяем предыдущие версии профиля
    // (как в /api/plan/route.ts)
    const previousProfiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 2,
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

    // Если плана нет ни в текущей, ни в предыдущих версиях, возвращаем сообщение
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

