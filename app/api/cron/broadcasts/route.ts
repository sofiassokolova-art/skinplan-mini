// Cron-эндпоинт отложенных рассылок.
// Настраивается через внешний планировщик (GitHub Actions / cron-job.org),
// который дёргает этот URL с CRON_SECRET. См. .github/workflows/cron-broadcasts.yml.

import { NextRequest, NextResponse } from 'next/server';
import { runBroadcastWorker } from '@/lib/broadcast-worker';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    // Секрет можно передать как ?secret=... или Authorization: Bearer ...
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || authHeader?.replace('Bearer ', '');

    if (secret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ВАЖНО: вызываем логику воркера НАПРЯМУЮ, без HTTP self-subrequest.
    // Раньше тут был fetch на собственный /api/admin/broadcasts/worker, который
    // на Cloudflare Workers падал с "error code: 522" (worker → свой публичный хост).
    const worker = await runBroadcastWorker();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      worker,
    });
  } catch (error: any) {
    console.error('Error in cron broadcasts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
