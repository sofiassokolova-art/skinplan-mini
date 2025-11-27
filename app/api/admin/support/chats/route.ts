// app/api/admin/support/chats/route.ts
// Получение списка чатов поддержки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) return false;
    
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chats = await prisma.supportChat.findMany({
      where: {
        status: { in: ['active', 'open'] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            telegramId: true,
            createdAt: true,
            skinProfiles: {
              orderBy: { createdAt: 'desc' },
              take: 1, // Берем последний профиль
              select: {
                skinType: true,
                sensitivityLevel: true,
                acneLevel: true,
                pigmentationRisk: true,
                rosaceaRisk: true,
                ageGroup: true,
                hasPregnancy: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const formattedChats = chats.map((chat) => {
      const latestProfile = chat.user.skinProfiles[0];
      // Формируем объект profile для совместимости с фронтендом
      const profile = latestProfile ? {
        skinType: latestProfile.skinType,
        concerns: [
          latestProfile.acneLevel && latestProfile.acneLevel > 0 ? 'acne' : null,
          latestProfile.pigmentationRisk && latestProfile.pigmentationRisk !== 'none' ? 'pigmentation' : null,
          latestProfile.rosaceaRisk && latestProfile.rosaceaRisk !== 'none' ? 'redness' : null,
        ].filter(Boolean),
        sensitivityLevel: latestProfile.sensitivityLevel,
        ageGroup: latestProfile.ageGroup,
        hasPregnancy: latestProfile.hasPregnancy,
      } : null;

      return {
        id: chat.id,
        user: {
          ...chat.user,
          profile, // Добавляем сформированный profile
        },
        lastMessage: chat.messages[0]?.text || chat.lastMessage,
        unread: chat.unread,
        updatedAt: chat.updatedAt.toISOString(),
        status: chat.status,
      };
    });

    return NextResponse.json({ chats: formattedChats });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

