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
    // ИСПРАВЛЕНО: берём именно ПОСЛЕДНИЕ 50 (desc + take), иначе asc+take отдавал
    // самые СТАРЫЕ 50 и админ не видел свежих сообщений в длинном чате.
    // Затем разворачиваем обратно в хронологический порядок для отображения.
    const recentMessages = await prisma.supportMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        // ИСПРАВЛЕНО (P1): Только нужные поля для снижения payload
        id: true,
        text: true,
        isAdmin: true,
        createdAt: true,
      },
    });
    const messages = recentMessages.reverse();

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

