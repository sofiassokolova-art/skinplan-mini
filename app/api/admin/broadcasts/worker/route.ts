// Обрабатывает рассылки в статусе scheduled (когда время пришло) или sending (немедленно).
// Логика вынесена в lib/broadcast-worker.ts, чтобы её можно было вызывать и напрямую
// (из cron-роута), и по HTTP (этот эндпоинт — для админки и внешнего планировщика).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminBoolean } from '@/lib/admin-auth';
import { runBroadcastWorker } from '@/lib/broadcast-worker';

// POST - обработка рассылок (вызывается cron/внешним планировщиком или админом)
export async function POST(request: NextRequest) {
  try {
    // Worker может вызываться cron (Bearer CRON_SECRET) или админом (с авторизацией)
    const authHeader = request.headers.get('authorization');
    const isCronCall = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCronCall) {
      const isAdmin = await verifyAdminBoolean(request);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await runBroadcastWorker();

    if (!result.success && result.error === 'TELEGRAM_BOT_TOKEN not configured') {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in broadcast worker:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
