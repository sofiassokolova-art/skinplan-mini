// Варианты инфо-экранов анкеты под цель ухода.
//
// Отдаём ВСЕ активные варианты экрана, а выбор делает клиент: цели пользователь
// отмечает в самом начале анкеты, и в этот момент ответы ещё живут в состоянии
// квиза, а не в БД (профиль собирается только на сабмите). Серверный выбор
// потребовал бы гонять ответы туда-обратно ради трёх строк текста.
//
// Данных персональных нет, поэтому ручка публичная и кешируемая.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const screenId = request.nextUrl.searchParams.get('screenId');
  if (!screenId) {
    return NextResponse.json({ error: 'screenId is required' }, { status: 400 });
  }

  try {
    const variants = await prisma.quizScreenVariant.findMany({
      where: { screenId, isActive: true },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      select: {
        focusKey: true,
        imageUrl: true,
        eyebrow: true,
        quote: true,
        bodyTitle: true,
        bodyText: true,
        priority: true,
      },
    });

    const res = NextResponse.json({ variants });
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res;
  } catch (error) {
    // Контент не критичен: у экрана есть вшитый дефолт, поэтому на ошибке БД
    // отдаём пустой список, а не 5xx — иначе анкета встанет из-за текста.
    logger.error('Failed to load quiz screen variants', error, { screenId });
    return NextResponse.json({ variants: [] });
  }
}
