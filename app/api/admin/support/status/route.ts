// app/api/admin/support/status/route.ts
// Изменение статуса обращения поддержки

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

export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
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

