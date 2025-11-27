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
            profile: true, // Добавляем профиль для отображения типа кожи и проблем
            createdAt: true,
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

    const formattedChats = chats.map((chat) => ({
      id: chat.id,
      user: chat.user,
      lastMessage: chat.messages[0]?.text || chat.lastMessage,
      unread: chat.unread,
      updatedAt: chat.updatedAt.toISOString(),
      status: chat.status,
    }));

    return NextResponse.json({ chats: formattedChats });
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

