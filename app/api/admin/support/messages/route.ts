// app/api/admin/support/messages/route.ts
// Получение сообщений чата

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

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // Получаем сообщения
    const messages = await prisma.supportMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    // Отмечаем сообщения как прочитанные
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

