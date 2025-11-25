// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface PlanDay {
  day: number;
  week: number;
  morning: string[];
  evening: string[];
  products: Record<string, {
    id: number;
    name: string;
    brand: string;
    step: string;
  }>;
  completed: boolean;
}

interface PlanWeek {
  week: number;
  days: PlanDay[];
  summary: {
    focus: string[];
    productsCount: number;
  };
}

interface GeneratedPlan {
  profile: {
    skinType: string;
    primaryFocus: string;
    concerns: string[];
    ageGroup: string;
  };
  weeks: PlanWeek[];
  infographic: {
    progress: Array<{
      week: number;
      acne: number;
      pores: number;
      hydration: number;
      pigmentation: number;
    }>;
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    available: string;
    imageUrl?: string;
  }>;
}

/**
 * Генерирует 28-дневный план на основе профиля и ответов анкеты
 */
async function generate28DayPlan(userId: string): Promise<GeneratedPlan> {
  // Получаем профиль кожи
  const profile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!profile) {
    throw new Error('No skin profile found');
  }

  // Получаем ответы пользователя
  const userAnswers = await prisma.userAnswer.findMany({
    where: {
      userId,
      questionnaireId: 2, // v2 анкета
    },
    include: {
      question: {
        include: {
          answerOptions: true,
        },
      },
    },
  });

  // Парсим ответы в удобный формат
  const answers: Record<string, any> = {};
  userAnswers.forEach((answer) => {
    const code = answer.question.code;
    if (answer.answerValue) {
      answers[code] = answer.answerValue;
    } else if (answer.answerValues) {
      answers[code] = JSON.parse(JSON.stringify(answer.answerValues));
    }
  });

  // Определяем основной фокус
  const goals = Array.isArray(answers.skin_goals) ? answers.skin_goals : [];
  const concerns = Array.isArray(answers.skin_concerns) ? answers.skin_concerns : [];
  
  let primaryFocus = 'general';
  if (goals.includes('Акне и высыпания') || concerns.includes('Акне')) {
    primaryFocus = 'acne';
  } else if (goals.includes('Сократить видимость пор') || concerns.includes('Расширенные поры')) {
    primaryFocus = 'pores';
  } else if (concerns.includes('Сухость')) {
    primaryFocus = 'dryness';
  } else if (goals.includes('Выровнять пигментацию') || concerns.includes('Пигментация')) {
    primaryFocus = 'pigmentation';
  } else if (goals.includes('Морщины и мелкие линии') || concerns.includes('Морщины')) {
    primaryFocus = 'wrinkles';
  }

  // Получаем рекомендации
  let recommendations = await prisma.recommendationSession.findFirst({
    where: {
      userId,
      profileId: profile.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Если рекомендаций нет, создаем их на лету
  if (!recommendations) {
    console.log(`⚠️ No RecommendationSession found for user ${userId}, creating recommendations...`);
    
    // Получаем все активные правила
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    // Находим подходящее правило
    let matchedRule: any = null;
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      let matches = true;

      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = (profile as any)[key];

        if (Array.isArray(condition)) {
          if (!condition.includes(profileValue)) {
            matches = false;
            break;
          }
        } else if (typeof condition === 'object' && condition !== null) {
          if ('gte' in condition && typeof profileValue === 'number') {
            if (profileValue < condition.gte!) {
              matches = false;
              break;
            }
          }
          if ('lte' in condition && typeof profileValue === 'number') {
            if (profileValue > condition.lte!) {
              matches = false;
              break;
            }
          }
        } else if (condition !== profileValue) {
          matches = false;
          break;
        }
      }

      if (matches) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule) {
      const stepsJson = matchedRule.stepsJson as any;
      const productIds: number[] = [];

      // Собираем продукты
      for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
        const where: any = { status: 'published' };
        const step = stepConfig as any;

        if (step.category && Array.isArray(step.category) && step.category.length > 0) {
          where.category = { in: step.category };
        }
        if (step.skin_types && Array.isArray(step.skin_types) && step.skin_types.length > 0) {
          where.skinTypes = { hasSome: step.skin_types };
        }
        if (step.concerns && Array.isArray(step.concerns) && step.concerns.length > 0) {
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
          take: step.max_items || 3,
          orderBy: { createdAt: 'desc' },
        });

        productIds.push(...products.map(p => p.id));
      }

      // Создаем RecommendationSession
      recommendations = await prisma.recommendationSession.create({
        data: {
          userId,
          profileId: profile.id,
          ruleId: matchedRule.id,
          products: productIds,
        },
      });

      console.log(`✅ RecommendationSession created on-the-fly with ${productIds.length} products`);
    } else {
      throw new Error('No matching recommendation rule found. Please configure recommendation rules in the admin panel.');
    }
  }

  // Получаем продукты из сессии
  const productIds = Array.isArray(recommendations.products) 
    ? recommendations.products as number[]
    : [];

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: 'published',
    },
    include: {
      brand: true,
    },
  });

  // Группируем продукты по шагам
  const productsByStep: Record<string, typeof products> = {};
  products.forEach((product) => {
    const step = product.step || 'other';
    if (!productsByStep[step]) {
      productsByStep[step] = [];
    }
    productsByStep[step].push(product);
  });

  // Определяем базовые шаги на основе предпочтений
  const stepsPreference = typeof answers.care_steps === 'string' 
    ? answers.care_steps 
    : Array.isArray(answers.care_steps) 
      ? answers.care_steps[0] 
      : 'средний';
  let maxSteps = 3;
  if (stepsPreference && typeof stepsPreference === 'string') {
    if (stepsPreference.includes('Минимум')) maxSteps = 2;
    else if (stepsPreference.includes('Средний')) maxSteps = 4;
    else if (stepsPreference.includes('Максимум')) maxSteps = 5;
  }

  const baseSteps = ['cleanser', 'toner', 'treatment', 'moisturizer', 'spf'].slice(0, maxSteps);
  
  // Генерируем план на 4 недели
  const weeks: PlanWeek[] = [];
  
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const days: PlanDay[] = [];
    
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const day = (weekNum - 1) * 7 + dayNum;
      
      // Постепенное введение продуктов
      const morningSteps = baseSteps.slice(0, 2 + Math.floor((weekNum - 1) / 2));
      const eveningSteps = baseSteps.slice(0, 3 + Math.floor((weekNum - 1) / 2));
      
      // Убираем SPF из вечернего ухода
      const eveningStepsFiltered = eveningSteps.filter(s => s !== 'spf');
      
      // Собираем продукты для дня
      const dayProducts: Record<string, any> = {};
      [...morningSteps, ...eveningStepsFiltered].forEach((step) => {
        if (productsByStep[step] && productsByStep[step].length > 0) {
          dayProducts[step] = {
            id: productsByStep[step][0].id,
            name: productsByStep[step][0].name,
            brand: productsByStep[step][0].brand.name,
            step: step,
          };
        }
      });
      
      days.push({
        day,
        week: weekNum,
        morning: morningSteps.filter(s => productsByStep[s]?.length > 0),
        evening: eveningStepsFiltered.filter(s => productsByStep[s]?.length > 0),
        products: dayProducts,
        completed: false,
      });
    }
    
    const weekProducts = days.length > 0 ? Object.keys(days[0].products).length : 0;
    
    weeks.push({
      week: weekNum,
      days,
      summary: {
        focus: [primaryFocus],
        productsCount: weekProducts,
      },
    });
  }

  // Генерируем инфографику прогресса
  const infographic = {
    progress: [
      { week: 1, acne: 25, pores: 20, hydration: 30, pigmentation: 15 },
      { week: 2, acne: 45, pores: 40, hydration: 55, pigmentation: 30 },
      { week: 3, acne: 70, pores: 65, hydration: 80, pigmentation: 55 },
      { week: 4, acne: 90, pores: 85, hydration: 95, pigmentation: 80 },
    ],
  };

  // Форматируем продукты для карусели
  const formattedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand.name,
    category: p.category,
    price: 0, // TODO: добавить поле price в схему Product
    available: 'Apteka.ru, Ozon', // TODO: добавить поле available в схему Product
    imageUrl: p.imageUrl || undefined,
  }));

  return {
    profile: {
      skinType: profile.skinType || 'normal',
      primaryFocus,
      concerns: concerns.slice(0, 3),
      ageGroup: profile.ageGroup || '25-34',
    },
    weeks,
    infographic,
    products: formattedProducts,
  };
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

    const plan = await generate28DayPlan(userId);

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

