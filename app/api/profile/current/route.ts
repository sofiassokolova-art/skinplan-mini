// app/api/profile/current/route.ts
// Получение текущего профиля пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/profile/current';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      return auth.response;
    }
    userId = auth.ctx.userId;

    // Получаем последний профиль пользователя
    // ВАЖНО: Используем orderBy по version DESC, чтобы получить последнюю версию
    // При перепрохождении анкеты создается новая версия профиля
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    if (!profile) {
      // Это нормальная ситуация для пользователей, которые еще не прошли анкету
      // Возвращаем 200 с null вместо 404 для более RESTful подхода
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      
      return NextResponse.json(null, { status: 200 });
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
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
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
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
