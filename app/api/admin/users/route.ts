// app/api/admin/users/route.ts
// API для получения списка пользователей

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - список всех пользователей
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    console.log(`📊 Fetching users: page=${page}, limit=${limit}`);

    // Получаем пользователей с их профилями и планами
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        include: {
          skinProfiles: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          recommendationSessions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          plan28s: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              skinProfiles: true,
              recommendationSessions: true,
              plan28s: true,
              planFeedbacks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    console.log(`✅ Found ${users.length} users (total: ${total})`);

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasProfile: user.skinProfiles.length > 0,
        // ИСПРАВЛЕНО: План может быть в Plan28 или recommendationSessions
        hasPlan: user.plan28s.length > 0 || user.recommendationSessions.length > 0,
        profileCount: user._count.skinProfiles,
        planCount: user._count.plan28s + user._count.recommendationSessions,
        feedbackCount: user._count.planFeedbacks,
        latestProfile: user.skinProfiles[0] || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

