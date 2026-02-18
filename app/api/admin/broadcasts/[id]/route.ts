// app/api/admin/broadcasts/[id]/route.ts
// API для управления конкретной рассылкой

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromTelegramId } from '@/lib/get-user-from-telegram-id';
import { verifyAdminBoolean } from '@/lib/admin-auth';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Отправить рассылку
async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

// Фильтрация пользователей по условиям
async function filterUsers(filtersJson: any) {
  const where: any = {};

  if (filtersJson.skinType) {
    where.skinProfiles = {
      some: {
        skinType: filtersJson.skinType,
      },
    };
  }

  if (filtersJson.ageGroup) {
    where.skinProfiles = {
      some: {
        ageGroup: filtersJson.ageGroup,
      },
    };
  }

  // Можно добавить больше фильтров

  const users = await prisma.user.findMany({
    where,
    include: {
      skinProfiles: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return users;
}

// Получить рассылку по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const broadcast = await prisma.broadcastMessage.findUnique({
      where: { id },
    });

    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    }

    return NextResponse.json({ broadcast });
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Обновить рассылку
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const broadcast = await prisma.broadcastMessage.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ broadcast });
  } catch (error) {
    console.error('Error updating broadcast:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Отправить рассылку
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const broadcast = await prisma.broadcastMessage.findUnique({
      where: { id },
    });

    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    }

    if (broadcast.status === 'sending' || broadcast.status === 'completed') {
      return NextResponse.json(
        { error: 'Broadcast already sent or in progress' },
        { status: 400 }
      );
    }

    // Обновляем статус
    await prisma.broadcastMessage.update({
      where: { id },
      data: { status: 'sending' },
    });

    // Получаем пользователей по фильтрам
    const users = await filterUsers(broadcast.filtersJson as any);

    let sentCount = 0;
    let failedCount = 0;

    // Отправляем сообщения
    for (const user of users) {
      try {
        await sendTelegramMessage(user.telegramId, broadcast.message);
        sentCount++;
        
        // Небольшая задержка, чтобы не превысить лимиты Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Failed to send message to user ${user.id}:`, error);
        failedCount++;
      }
    }

    // Обновляем рассылку
    const updated = await prisma.broadcastMessage.update({
      where: { id },
      data: {
        status: 'completed',
        sentCount,
        failedCount,
        totalCount: users.length,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ broadcast: updated });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    
    // Обновляем статус на ошибку
    try {
      await prisma.broadcastMessage.update({
        where: { id: (await params).id },
        data: { status: 'draft' },
      });
    } catch {}

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

