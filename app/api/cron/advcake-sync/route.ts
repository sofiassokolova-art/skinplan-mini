// app/api/cron/advcake-sync/route.ts
// Ежедневный синк заказов Adv.Cake (оффер Gold Apple) в БД.
// Тянем days=7 с корзиной — перекрытие в неделю ловит обновления статусов оплаты
// по уже виденным заказам (upsert по orderId). Дёргается внешним планировщиком
// (GitHub Actions) с Bearer CRON_SECRET — раз в день.

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';
import { syncAdvcakeOrders } from '@/lib/advcake';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const offer = process.env.ADVCAKE_OFFER || 'goldappleru';
    const result = await syncAdvcakeOrders({ days: 7, offer, basket: true });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    logger.error('Adv.Cake sync cron error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 },
    );
  }
}
