// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { getCorrelationId, addCorrelationIdToHeaders } from '@/lib/utils/correlation-id';
import { addCacheHeaders, CachePresets } from '@/lib/utils/api-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/profile/current';
  let userId: string | undefined;
  const correlationId = getCorrelationId(request) || undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      return auth.response;
    }
    userId = auth.ctx.userId;

    // Единый резолвер активного профиля (без лишних debug-запросов к БД — уменьшает very_slow API)
    // Это обеспечивает консистентность с /api/plan и правильно обрабатывает отсутствие current_profile_id
    const profile = await getCurrentProfile(userId);

    if (!profile) {
      // Это нормальная ситуация для пользователей, которые еще не прошли анкету
      // Возвращаем 200 с null вместо 404 для более RESTful подхода
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId, correlationId);
      
      // Для отсутствующего профиля кэшируем на 1 минуту (может появиться)
      const response = NextResponse.json(null, { status: 200 });
      const responseWithCache = addCacheHeaders(response, CachePresets.shortCache());
      if (correlationId) {
        addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
      }
      return responseWithCache;
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
    
    const response = NextResponse.json({
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
    const responseWithCache = addCacheHeaders(response, CachePresets.mediumCache());
    if (correlationId) {
      addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
    }
    return responseWithCache;
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId, correlationId);

    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    if (correlationId) {
      addCorrelationIdToHeaders(correlationId, errorResponse.headers);
    }
    return errorResponse;
  }
}
