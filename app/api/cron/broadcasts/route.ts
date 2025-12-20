// app/api/cron/broadcasts/route.ts
// Cron endpoint для вызова worker рассылок
// Настраивается в vercel.json или через Vercel Cron Jobs

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // ИСПРАВЛЕНО: Проверка секрета для защиты от несанкционированных вызовов
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    // Проверяем секрет (Vercel Cron автоматически добавляет заголовок)
    // Или можно использовать query параметр ?secret=...
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || authHeader?.replace('Bearer ', '');
    
    if (secret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Вызываем worker
    const workerUrl = new URL('/api/admin/broadcasts/worker', request.url);
    workerUrl.protocol = request.url.startsWith('https') ? 'https:' : 'http:';
    
    const workerResponse = await fetch(workerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    const workerData = await workerResponse.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      worker: workerData,
    });
  } catch (error: any) {
    console.error('Error in cron broadcasts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

