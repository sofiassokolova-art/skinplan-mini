import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    logger.error('DB ping failed', error, {
      errorName: error?.name,
      errorCode: error?.code,
      errorMessage: error?.message?.substring(0, 300),
    });
    return NextResponse.json({ ok: false, error: error?.name ?? 'unknown' }, { status: 503 });
  }
}
