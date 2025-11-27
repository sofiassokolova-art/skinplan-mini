// app/api/admin/broadcasts/route.ts
// API для управления рассылками

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Проверка авторизации админа
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      console.log('❌ No token found in broadcasts API');
      return false;
    }
    
    try {
      jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verified in broadcasts API');
      return true;
    } catch (verifyError) {
      console.error('❌ Token verification failed in broadcasts API:', verifyError);
      return false;
    }
  } catch (err) {
    console.error('❌ Error in verifyAdmin broadcasts:', err);
    return false;
  }
}

// Получить все рассылки
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const broadcasts = await prisma.broadcastMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ broadcasts });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Создать новую рассылку
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, message, filtersJson, scheduledAt } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title,
        message,
        filtersJson: filtersJson || {},
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        totalCount: 0,
        sentCount: 0,
        failedCount: 0,
      },
    });

    return NextResponse.json({ broadcast });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

