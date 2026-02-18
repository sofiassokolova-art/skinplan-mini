// app/api/admin/support/close/route.ts
// Закрытие обращения поддержки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    // Закрываем обращение
    const chat = await prisma.supportChat.update({
      where: { id: chatId },
      data: {
        status: 'closed',
        // Сбрасываем флаг автоответа, чтобы при новом обращении он снова отправлялся
        autoReplySent: false,
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
    console.error('Error closing chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

