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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 100);
    const skip = (page - 1) * limit;
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const where = search
      ? {
          OR: [
            { telegramId: search },
            { username: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    // Получаем пользователей с их профилями, планами и оплатой
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          entitlements: {
            where: {
              code: 'paid_access',
            },
            orderBy: { updatedAt: 'desc' },
          },
          payments: {
            where: {
              status: 'succeeded',
              productCode: 'plan_access',
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
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
      prisma.user.count({ where }),
    ]);

    const usersPayload = users.map((user) => {
      const paidEntitlement = user.entitlements.find(
        (e) =>
          e.code === 'paid_access' &&
          e.active === true &&
          (!e.validUntil || e.validUntil > new Date())
      );

      const lastPayment = user.payments[0] || null;

      return {
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
        // Оплата/доступ
        hasPaidAccess: !!paidEntitlement,
        paidAccessValidUntil: paidEntitlement?.validUntil || null,
        lastPaymentAt: lastPayment?.createdAt || null,
        lastPaymentAmount: lastPayment?.amount || null,
        lastPaymentCurrency: lastPayment?.currency || null,
      };
    });

    return NextResponse.json({
      users: usersPayload,
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

