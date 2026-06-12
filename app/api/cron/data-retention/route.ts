// app/api/cron/data-retention/route.ts
// Срок хранения ПДн (152-ФЗ: не дольше, чем необходимо). Обезличивает персональные
// данные пользователей, неактивных дольше RETENTION_MONTHS (по умолчанию 24 мес.).
// Платежи сохраняются (54-ФЗ) — см. lib/privacy/purge-user-data.
// Дёргается внешним планировщиком (GitHub Actions) с Bearer CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { purgeUserPersonalData } from '@/lib/privacy/purge-user-data';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: NextRequest): boolean {
  if (process.env.CRON_SECRET) {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const months = Number(process.env.RETENTION_MONTHS) || 24;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    // Берём неактивных пользователей, у которых ещё есть персональные данные.
    // Батч ограничен, чтобы уложиться в лимит времени функции.
    const stale = await prisma.user.findMany({
      where: {
        lastActive: { not: null, lt: cutoff },
        OR: [{ firstName: { not: null } }, { phoneNumber: { not: null } }, { username: { not: null } }],
      },
      select: { id: true },
      take: 200,
    });

    let purged = 0;
    for (const u of stale) {
      try {
        await purgeUserPersonalData(u.id);
        purged++;
      } catch (e) {
        logger.error('Retention purge failed for user', { userId: u.id, error: e });
      }
    }

    logger.info('Data retention purge completed', { months, cutoff: cutoff.toISOString(), candidates: stale.length, purged });

    return NextResponse.json({ success: true, months, cutoff: cutoff.toISOString(), purged });
  } catch (error: any) {
    logger.error('Error in data retention cron', error);
    return NextResponse.json({ error: 'Internal server error', message: error?.message }, { status: 500 });
  }
}
