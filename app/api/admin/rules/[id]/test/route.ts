// app/api/admin/rules/[id]/test/route.ts
// API для тестирования правила на конкретном пользователе

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin } from '@/lib/admin-auth';
import { generateRecommendationsForProfile } from '@/lib/recommendations-generator';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const auth = await verifyAdmin(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Получаем правило
    const rule = await prisma.recommendationRule.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Получаем пользователя и его профиль
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.skinProfiles.length === 0) {
      return NextResponse.json(
        { error: 'User has no skin profile' },
        { status: 400 }
      );
    }

    const profile = user.skinProfiles[0];

    // Временно активируем только это правило для теста
    // Сохраняем текущее состояние всех правил
    const allRules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
    });

    // Деактивируем все правила
    await prisma.recommendationRule.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Активируем только тестируемое правило
    await prisma.recommendationRule.update({
      where: { id: parseInt(params.id) },
      data: { isActive: true },
    });

    try {
      // Генерируем рекомендации для пользователя
      const result = await generateRecommendationsForProfile(userId, profile.id);

      // Восстанавливаем состояние всех правил
      await prisma.recommendationRule.updateMany({
        where: { id: { in: allRules.map(r => r.id) } },
        data: { isActive: true },
      });

      if (!result.ok) {
        return NextResponse.json({
          success: false,
          error: result.reason || 'Failed to generate recommendations',
          rule: {
            id: rule.id,
            name: rule.name,
            matched: false,
          },
          profile: {
            id: profile.id,
            skinType: profile.skinType,
            sensitivityLevel: profile.sensitivityLevel,
          },
        });
      }

      // Проверяем, было ли использовано наше правило
      const session = await prisma.recommendationSession.findFirst({
        where: {
          userId: userId,
          profileId: profile.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          rule: true,
        },
      });

      const matched = session?.ruleId === rule.id;

      return NextResponse.json({
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          matched: matched,
        },
        profile: {
          id: profile.id,
          skinType: profile.skinType,
          sensitivityLevel: profile.sensitivityLevel,
          ageGroup: profile.ageGroup,
        },
        recommendations: {
          sessionId: session?.id || null,
          productCount: result.ok && 'productIds' in result ? result.productIds.length : 0,
          productIds: result.ok && 'productIds' in result ? result.productIds : [],
        },
        message: matched
          ? 'Правило успешно применено к пользователю'
          : 'Правило не подошло под профиль пользователя',
      });
    } catch (error: any) {
      // Восстанавливаем состояние всех правил в случае ошибки
      await prisma.recommendationRule.updateMany({
        where: { id: { in: allRules.map(r => r.id) } },
        data: { isActive: true },
      });

      throw error;
    }
  } catch (error: any) {
    console.error('Error testing rule:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

