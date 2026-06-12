// app/api/profile/delete/route.ts
// Самостоятельное удаление персональных данных пользователем (право субъекта ПДн, 152-ФЗ).
// Удаляем все персональные данные и отзываем согласия, но СОХРАНЯЕМ записи о платежах
// (Payment/Entitlement) — их Оператор обязан хранить для бухгалтерского/налогового учёта (54-ФЗ).
// Поэтому профиль пользователя не удаляется полностью, а обезличивается.

import { NextRequest, NextResponse } from 'next/server';
import { invalidateAllUserCache } from '@/lib/cache';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { purgeUserPersonalData } from '@/lib/privacy/purge-user-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    try {
      await invalidateAllUserCache(userId);
    } catch {
      // кэш не критичен
    }

    await purgeUserPersonalData(userId);

    return NextResponse.json({ success: true, message: 'Персональные данные удалены' });
  } catch (error: any) {
    console.error('Error deleting user data (self-service):', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
