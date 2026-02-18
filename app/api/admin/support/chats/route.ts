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

    // ИСПРАВЛЕНО (P0): Для списка чатов нужны только базовые данные
    // Загружаем только последнее сообщение для lastMessage, не всю историю
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
          take: 1, // ИСПРАВЛЕНО (P0): Только последнее сообщение для lastMessage
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // ИСПРАВЛЕНО (P0): Убрали авто-статус по тексту - возвращаем status как хранится в БД
    // Статус обновляется событийно: пользователь написал → active, админ ответил → in_progress, закрыт → closed
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

      // ИСПРАВЛЕНО (P0): Возвращаем status как хранится в БД, без авто-вычисления по тексту
      // Статус управляется событиями: sendReply → in_progress, close → closed
      return {
        id: chat.id,
        user: {
          ...chat.user,
          profile, // Добавляем сформированный profile
        },
        lastMessage: chat.messages[0]?.text || chat.lastMessage || null, // ИСПРАВЛЕНО (P1): Используем последнее сообщение или chat.lastMessage
        unread: chat.unread,
        updatedAt: chat.updatedAt.toISOString(),
        status: chat.status, // ИСПРАВЛЕНО (P0): Возвращаем status из БД, без авто-вычисления
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

