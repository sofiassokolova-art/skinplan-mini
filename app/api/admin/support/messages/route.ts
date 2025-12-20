// app/api/admin/support/messages/route.ts
// Получение сообщений чата

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // ИСПРАВЛЕНО (P0): Добавлен лимит сообщений для производительности
    // Без лимита через месяц будет 500+ сообщений × polling каждые 2 сек = огромная нагрузка
    const messages = await prisma.supportMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 50, // ИСПРАВЛЕНО (P0): Лимит сообщений (последние 50)
      select: {
        // ИСПРАВЛЕНО (P1): Только нужные поля для снижения payload
        id: true,
        text: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    // ИСПРАВЛЕНО (P0): Сбрасываем unread при открытии чата админом
    // Это критично - иначе unread остаётся > 0 даже после прочтения
    await prisma.supportChat.update({
      where: { id: chatId },
      data: { unread: 0 },
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      text: msg.text,
      isAdmin: msg.isAdmin,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

