// app/api/admin/support/chats/route.ts
// Получение списка чатов поддержки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chats = await prisma.supportChat.findMany({
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
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Автоматически определяем статус для каждого чата на основе сообщений
    const chatsWithAutoStatus = chats.map((chat) => {
      // Если статус закрыт, оставляем как есть
      if (chat.status === 'closed') {
        return { ...chat, autoStatus: 'closed' };
      }

      // Проверяем, есть ли ответы оператора (не автоответ)
      // Автоответ содержит "Привет! Это поддержка SkinIQ" или "за пределами рабочего времени"
      const hasAdminReply = chat.messages.some((msg) => 
        msg.isAdmin && 
        !msg.text.includes('Привет! Это поддержка SkinIQ') && 
        !msg.text.includes('за пределами рабочего времени') &&
        !msg.text.includes('Поддержка работает с 9:00 до 18:00')
      );

      const autoStatus = hasAdminReply ? 'in_progress' : 'active';
      return { ...chat, autoStatus };
    });

    const formattedChats = chatsWithAutoStatus.map((chat) => {
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

      // Используем автоматически определенный статус
      const displayStatus = chat.status === 'closed' ? 'closed' : chat.autoStatus;

      return {
        id: chat.id,
        user: {
          ...chat.user,
          profile, // Добавляем сформированный profile
        },
        lastMessage: chat.messages[0]?.text || chat.lastMessage,
        unread: chat.unread,
        updatedAt: chat.updatedAt.toISOString(),
        status: displayStatus, // Используем автоматически определенный статус
      };
    });

    // Сортируем: в работе, ждет ответа, закрыто
    formattedChats.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'in_progress': 0,
        'active': 1,
        'closed': 2,
      };
      const orderA = statusOrder[a.status] ?? 3;
      const orderB = statusOrder[b.status] ?? 3;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Если статус одинаковый, сортируем по дате обновления
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
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

