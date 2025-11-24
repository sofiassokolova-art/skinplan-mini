// app/api/recommendations/route.ts
// Получение рекомендаций продуктов на основе профиля

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

// Используем Node.js runtime для поддержки jsonwebtoken
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface RuleCondition {
  [key: string]: string[] | { gte?: number; lte?: number } | string;
}

interface RuleStep {
  category?: string[];
  concerns?: string[];
  skin_types?: string[];
  is_non_comedogenic?: boolean;
  is_fragrance_free?: boolean;
  max_items?: number;
}

interface Rule {
  id: number;
  name: string;
  conditionsJson: RuleCondition;
  stepsJson: Record<string, RuleStep>;
  priority: number;
}

/**
 * Проверяет, соответствует ли профиль условиям правила
 */
function matchesRule(profile: any, rule: Rule): boolean {
  const conditions = rule.conditionsJson;

  for (const [key, condition] of Object.entries(conditions)) {
    const profileValue = profile[key];

    if (Array.isArray(condition)) {
      // Проверка на соответствие массиву значений
      if (!condition.includes(profileValue)) {
        return false;
      }
    } else if (typeof condition === 'object' && condition !== null) {
      // Проверка на диапазон (gte, lte)
      if ('gte' in condition && typeof profileValue === 'number') {
        if (profileValue < condition.gte!) return false;
      }
      if ('lte' in condition && typeof profileValue === 'number') {
        if (profileValue > condition.lte!) return false;
      }
    } else if (condition !== profileValue) {
      return false;
    }
  }

  return true;
}

/**
 * Получает продукты по фильтрам шага
 */
async function getProductsForStep(step: RuleStep) {
  const where: any = {
    status: 'published',
  };

  if (step.category && step.category.length > 0) {
    where.category = { in: step.category };
  }

  if (step.skin_types && step.skin_types.length > 0) {
    where.skinTypes = { hasSome: step.skin_types };
  }

  if (step.concerns && step.concerns.length > 0) {
    where.concerns = { hasSome: step.concerns };
  }

  if (step.is_non_comedogenic === true) {
    where.isNonComedogenic = true;
  }

  if (step.is_fragrance_free === true) {
    where.isFragranceFree = true;
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      brand: true,
    },
    take: step.max_items || 3,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return products;
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Получаем последний профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'No skin profile found. Please complete the questionnaire first.' },
        { status: 404 }
      );
    }

    // Получаем все активные правила, отсортированные по приоритету
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    // Находим подходящее правило
    let matchedRule: Rule | null = null;
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as RuleCondition;
      if (matchesRule(profile, { ...rule, conditionsJson: conditions } as Rule)) {
        matchedRule = { ...rule, conditionsJson: conditions } as Rule;
        break;
      }
    }

    if (!matchedRule) {
      return NextResponse.json(
        { error: 'No matching recommendation rule found' },
        { status: 404 }
      );
    }

    // Получаем продукты для каждого шага
    const stepsJson = matchedRule.stepsJson as Record<string, RuleStep>;
    const steps: Record<string, any[]> = {};

    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      const products = await getProductsForStep(stepConfig);
      steps[stepName] = products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand.name,
        line: p.line,
        category: p.category,
        step: p.step,
        description: p.descriptionUser,
        marketLinks: p.marketLinks,
        imageUrl: p.imageUrl,
      }));
    }

    // Сохраняем сессию рекомендаций
    const productIds = Object.values(steps).flat().map(p => p.id);
    await prisma.recommendationSession.create({
      data: {
        userId,
        profileId: profile.id,
        ruleId: matchedRule.id,
        products: productIds,
      },
    });

    return NextResponse.json({
      profile_summary: {
        skinType: profile.skinType,
        sensitivityLevel: profile.sensitivityLevel,
        acneLevel: profile.acneLevel,
        notes: profile.notes,
      },
      rule: {
        name: matchedRule.name,
      },
      steps,
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
