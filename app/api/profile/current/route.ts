// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { prisma } from '@/lib/db';
import { logDbFingerprint } from '@/lib/db-fingerprint';
import { getCorrelationId, addCorrelationIdToHeaders } from '@/lib/utils/correlation-id';
import { addCacheHeaders, CachePresets } from '@/lib/utils/api-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/profile/current';
  let userId: string | undefined;
  const correlationId = getCorrelationId(request);

  try {
    // DEBUG: Логируем DB fingerprint для диагностики разных БД
    // Используем console.warn для гарантированного вывода в Vercel logs
    console.warn('🔍 [PROFILE/CURRENT] Starting DB fingerprint check...');
    const fingerprint = await logDbFingerprint('/api/profile/current');
    console.warn('🔍 [PROFILE/CURRENT] DB fingerprint:', JSON.stringify(fingerprint, null, 2));
    
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      return auth.response;
    }
    userId = auth.ctx.userId;

    // DEBUG: Проверяем идентичность БД
    try {
      const dbIdentity = await prisma.$queryRaw<Array<{ current_database: string; current_schema: string }>>`
        SELECT current_database() as current_database, current_schema() as current_schema
      `;
      logger.warn('DEBUG: DB identity in profile/current', { 
        userId,
        dbIdentity: dbIdentity[0],
        databaseUrl: process.env.DATABASE_URL ? 'set' : 'not set',
      });
    } catch (dbIdentityError) {
      logger.warn('DEBUG: Failed to get DB identity in profile/current', { error: (dbIdentityError as any)?.message });
    }

    // DEBUG: Проверяем количество профилей до вызова getCurrentProfile
    const profilesCountBefore = await prisma.skinProfile.count({ where: { userId } });
    logger.warn('DEBUG: profiles count before getCurrentProfile', { userId, profilesCountBefore });

    // ИСПРАВЛЕНО: Используем единый резолвер активного профиля
    // Это обеспечивает консистентность с /api/plan и правильно обрабатывает отсутствие current_profile_id
    const profile = await getCurrentProfile(userId);

    if (!profile) {
      // Это нормальная ситуация для пользователей, которые еще не прошли анкету
      // Возвращаем 200 с null вместо 404 для более RESTful подхода
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId, correlationId);
      
      // Для отсутствующего профиля кэшируем на 1 минуту (может появиться)
      let response = NextResponse.json(null, { status: 200 });
      response = addCacheHeaders(response, CachePresets.shortCache());
      addCorrelationIdToHeaders(correlationId, response.headers);
      return response;
    }

    // Преобразуем тип кожи в русский для отображения
    const skinTypeRuMap: Record<string, string> = {
      dry: 'Сухая',
      oily: 'Жирная',
      combo: 'Комбинированная',
      normal: 'Нормальная',
      sensitive: 'Чувствительная',
    };

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId, correlationId);
    
    let response = NextResponse.json({
      id: profile.id,
      version: profile.version,
      skinType: profile.skinType,
      skinTypeRu: skinTypeRuMap[profile.skinType || 'normal'] || 'Нормальная',
      sensitivityLevel: profile.sensitivityLevel,
      dehydrationLevel: profile.dehydrationLevel,
      acneLevel: profile.acneLevel,
      rosaceaRisk: profile.rosaceaRisk,
      pigmentationRisk: profile.pigmentationRisk,
      ageGroup: profile.ageGroup,
      hasPregnancy: profile.hasPregnancy,
      notes: profile.notes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      primaryConcernRu: 'Акне', // TODO: Вычислить из профиля
    });
    
    // Добавляем кэширование: профиль меняется редко, кэшируем на 5 минут
    response = addCacheHeaders(response, CachePresets.mediumCache());
    addCorrelationIdToHeaders(correlationId, response.headers);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId, correlationId);

    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    addCorrelationIdToHeaders(correlationId, errorResponse.headers);
    return errorResponse;
  }
}
