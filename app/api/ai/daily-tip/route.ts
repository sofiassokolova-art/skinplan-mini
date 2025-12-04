// app/api/ai/daily-tip/route.ts
// API для получения ежедневного совета на основе плана пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

interface DailyTipRequest {
  currentDay?: number;
  skinType?: string;
  concerns?: string[];
  currentProducts?: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return ApiResponse.unauthorized('Missing Telegram initData');
    }

    // Получаем userId
    const userIdResult = await getUserIdFromInitData(initData);
    if (!userIdResult) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }
    userId = userIdResult;

    const body = await request.json() as DailyTipRequest;

    // Получаем профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return ApiResponse.notFound('Profile not found');
    }

    // Получаем план пользователя
    const planProgress = await prisma.planProgress.findUnique({
      where: { userId },
    });

    const currentDay = body.currentDay || planProgress?.currentDay || 1;
    const skinType = body.skinType || profile.skinType || 'normal';
    const concerns = body.concerns || (profile.medicalMarkers as any)?.concerns || [];
    const currentProducts = body.currentProducts || [];

    // Формируем промпт для ChatGPT
    const prompt = `Ты профессиональный дерматолог. Дай краткий ежедневный совет по уходу за кожей (максимум 2-3 предложения) на основе следующей информации:
- День плана ухода: ${currentDay} из 28
- Тип кожи: ${skinType}
- Основные проблемы: ${concerns.join(', ') || 'нет'}
- Текущие средства: ${currentProducts.join(', ') || 'не указаны'}

Совет должен быть:
1. Практичным и конкретным
2. Связанным с текущим днем плана
3. Полезным для улучшения состояния кожи
4. Написанным дружелюбным тоном

Ответ должен быть только на русском языке, без дополнительных пояснений.`;

    // Вызываем ChatGPT API
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.warn('OPENAI_API_KEY not configured, returning default tip');
      return NextResponse.json({
        tip: getDefaultTip(currentDay, skinType, concerns),
        source: 'default',
      });
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Используем более дешевую модель
          messages: [
            {
              role: 'system',
              content: 'Ты профессиональный дерматолог, дающий краткие практические советы по уходу за кожей.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenAI API error', { status: response.status, error: errorText });
        return NextResponse.json({
          tip: getDefaultTip(currentDay, skinType, concerns),
          source: 'default',
        });
      }

      const data = await response.json();
      const tip = data.choices?.[0]?.message?.content?.trim() || getDefaultTip(currentDay, skinType, concerns);

      logger.info('Daily tip generated', { userId, currentDay, source: 'openai' });

      return NextResponse.json({
        tip,
        source: 'openai',
        day: currentDay,
      });
    } catch (openaiError: any) {
      logger.error('Error calling OpenAI API', { error: openaiError, userId });
      return NextResponse.json({
        tip: getDefaultTip(currentDay, skinType, concerns),
        source: 'default',
      });
    }
  } catch (error: any) {
    logger.error('Error generating daily tip', { error, userId });
    return ApiResponse.internalError(error, { userId });
  }
}

// Функция для генерации дефолтного совета, если ChatGPT недоступен
function getDefaultTip(day: number, skinType: string, concerns: string[]): string {
  const tips = [
    'Не забывайте наносить SPF каждый день, даже в пасмурную погоду. Это основа защиты от фотостарения.',
    'Пейте достаточно воды — это важно для увлажнения кожи изнутри.',
    'Будьте терпеливы: результаты ухода видны через 4-6 недель регулярного применения.',
    'Если появилось раздражение, сделайте паузу в использовании активных ингредиентов на 2-3 дня.',
    'Наносите средства по массажным линиям — это улучшает впитывание и предотвращает растяжение кожи.',
  ];

  // Выбираем совет на основе дня (циклически)
  const tipIndex = (day - 1) % tips.length;
  return tips[tipIndex];
}

