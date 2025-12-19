// app/api/admin/support/status/route.ts
// Изменение статуса обращения поддержки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, status } = body;

    if (!chatId || !status) {
      return NextResponse.json(
        { error: 'chatId and status are required' },
        { status: 400 }
      );
    }

    // Проверяем, что статус валидный
    const validStatuses = ['active', 'in_progress', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: active, in_progress, closed' },
        { status: 400 }
      );
    }

    // Обновляем статус
    const chat = await prisma.supportChat.update({
      where: { id: chatId },
      data: {
        status,
        // Если закрываем, сбрасываем флаг автоответа для нового обращения
        ...(status === 'closed' && { autoReplySent: false }),
      },
    });

    return NextResponse.json({
      success: true,
      chat: {
        id: chat.id,
        status: chat.status,
      },
    });
  } catch (error: any) {
    console.error('Error updating chat status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

