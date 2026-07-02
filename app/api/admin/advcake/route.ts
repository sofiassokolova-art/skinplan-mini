// app/api/admin/advcake/route.ts
// Админ-чтение заказов Adv.Cake (список + агрегаты) и ручной запуск синка.
//   GET  — пагинированный список + сводка (заказы/комиссия, разбивка по статусам)
//   POST — «Обновить сейчас»: дёргает syncAdvcakeOrders под админ-авторизацией

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';
import { syncAdvcakeOrders } from '@/lib/advcake';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAYMENT_STATUSES = [
  'open',
  'on_hold',
  'balance',
  'processing',
  'withdrawal',
  'not_apply',
] as const;

function dec(v: unknown): number {
  // Prisma Decimal | null → number для JSON (в рублях, может быть дробным).
  return v == null ? 0 : Number(v.toString());
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminBoolean(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '50', 10) || 50, 1), 200);
  const paymentStatus = searchParams.get('paymentStatus') || undefined;
  const paid = searchParams.get('paid') || undefined;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where: Record<string, unknown> = { orderDate: { gte: since } };
  if (paymentStatus && PAYMENT_STATUSES.includes(paymentStatus as never)) {
    where.paymentStatus = paymentStatus;
  }
  if (paid === 'yes' || paid === 'no') where.paid = paid;

  try {
    const [total, totals, byStatus, orders] = await Promise.all([
      prisma.advcakeOrder.count({ where }),
      prisma.advcakeOrder.aggregate({
        where,
        _count: { _all: true },
        _sum: { commission: true, price: true },
      }),
      prisma.advcakeOrder.groupBy({
        by: ['paymentStatus'],
        where,
        _count: { _all: true },
        _sum: { commission: true },
      }),
      prisma.advcakeOrder.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
    ]);

    return NextResponse.json({
      summary: {
        orders: total,
        commission: dec(totals._sum.commission),
        revenue: dec(totals._sum.price),
        byStatus: byStatus.map((s) => ({
          paymentStatus: s.paymentStatus,
          orders: s._count._all,
          commission: dec(s._sum.commission),
        })),
      },
      page,
      pageSize,
      total,
      orders: orders.map((o) => ({
        ...o,
        price: dec(o.price),
        commission: dec(o.commission),
        items: o.items.map((it) => ({
          ...it,
          unitPrice: dec(it.unitPrice),
          commission: dec(it.commission),
        })),
      })),
    });
  } catch (error: any) {
    logger.error('Adv.Cake admin list error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminBoolean(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const offer = process.env.ADVCAKE_OFFER || 'goldappleru';
    const result = await syncAdvcakeOrders({ days: 7, offer, basket: true });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Adv.Cake manual sync error', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error?.message },
      { status: 500 },
    );
  }
}
