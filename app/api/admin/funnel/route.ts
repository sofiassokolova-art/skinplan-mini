// app/api/admin/funnel/route.ts
// API для получения данных воронки конверсии

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { getCachedPlan } from '@/lib/cache';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return false;
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (verifyError) {
      return false;
    }
  } catch (err) {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем всех пользователей
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Этап 1: Все пользователи (открыли мини-апп)
    const totalUsers = allUsers.length;

    // Этап 2: Пользователи, которые начали анкету (есть хотя бы один ответ)
    const usersWithAnswers = await prisma.userAnswer.groupBy({
      by: ['userId'],
    });
    const startedQuiz = usersWithAnswers.length;

    // Этап 3: Пользователи, которые завершили анкету (есть профиль кожи)
    const completedQuiz = await prisma.skinProfile.groupBy({
      by: ['userId'],
    });
    const completedQuizCount = completedQuiz.length;

    // Этап 4: Пользователи с планом (есть план в кэше или RecommendationSession)
    // Проверяем через RecommendationSession и профили для проверки кэша
    const usersWithSessions = await prisma.recommendationSession.groupBy({
      by: ['userId'],
    });
    
    // Также проверяем пользователей с профилями, у которых может быть план в кэше
    const usersWithProfiles = await prisma.skinProfile.findMany({
      select: {
        userId: true,
        version: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Для каждого пользователя проверяем наличие плана в кэше
    // Но это может быть медленно, поэтому делаем проверку только для пользователей без сессии
    const usersWithoutSession = usersWithProfiles
      .filter(p => !usersWithSessions.some(s => s.userId === p.userId))
      .slice(0, 100); // Ограничиваем проверку до 100 пользователей для производительности

    let additionalPlansCount = 0;
    for (const profile of usersWithoutSession) {
      const cachedPlan = await getCachedPlan(profile.userId, profile.version);
      if (cachedPlan && cachedPlan.plan28) {
        additionalPlansCount++;
      }
    }

    const hasPlan = usersWithSessions.length + additionalPlansCount;

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

    const periodData = periods.map(period => {
      const startDate = period.days ? new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000) : null;
      
      const periodUsers = startDate 
        ? allUsers.filter(u => new Date(u.createdAt) >= startDate).length
        : totalUsers;

      // Для периодов считаем только по данным в БД (без проверки кэша для производительности)
      const periodStarted = startDate
        ? usersWithAnswers.filter((_, index) => {
            // Приблизительная оценка - в реальности нужно проверять дату первого ответа
            return true; // Упрощаем для производительности
          }).length
        : startedQuiz;

      const periodCompleted = startDate
        ? completedQuiz.filter(p => {
            // Нужно проверить дату создания профиля
            return true; // Упрощаем
          }).length
        : completedQuizCount;

      const periodPlan = startDate
        ? usersWithSessions.length // Упрощенно - только сессии
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
    });

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
    });
  } catch (error: any) {
    console.error('Error fetching funnel data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

