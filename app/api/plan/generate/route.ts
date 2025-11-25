// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей (улучшенная версия по методике)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan, setCachedPlan } from '@/lib/cache';

export const runtime = 'nodejs';

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
    sensitivityLevel?: string | null;
    acneLevel?: number | null;
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
      wrinkles: number;
    }>;
    chartConfig: {
      type: string;
      data: any;
      options: any;
    };
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    available: string;
    imageUrl?: string;
    ingredients?: string[];
  }>;
  warnings?: string[]; // Предупреждения об аллергиях и исключениях
}

// Вспомогательная функция: определение бюджетного сегмента
function getBudgetTier(price: number | null | undefined): 'бюджетный' | 'средний' | 'премиум' {
  if (!price || price < 2000) return 'бюджетный';
  if (price < 5000) return 'средний';
  return 'премиум';
}

// Вспомогательная функция: проверка, содержит ли продукт исключенные ингредиенты
function containsExcludedIngredients(
  productIngredients: string[] | null | undefined,
  excludedIngredients: string[]
): boolean {
  if (!productIngredients || productIngredients.length === 0) return false;
  if (!excludedIngredients || excludedIngredients.length === 0) return false;
  
  const productIngredientsLower = productIngredients.map(ing => ing.toLowerCase());
  const excludedLower = excludedIngredients.map(ex => ex.toLowerCase());
  
  return excludedLower.some(excluded => 
    productIngredientsLower.some(ing => ing.includes(excluded) || excluded.includes(ing))
  );
}

// Вспомогательная функция: содержит ли продукт ретинол
function containsRetinol(productIngredients: string[] | null | undefined): boolean {
  if (!productIngredients || productIngredients.length === 0) return false;
  const ingredientsLower = productIngredients.map(ing => ing.toLowerCase());
  return ingredientsLower.some(ing => 
    ing.includes('ретинол') || 
    ing.includes('retinol') || 
    ing.includes('адапален') ||
    ing.includes('adapalene') ||
    ing.includes('третиноин') ||
    ing.includes('tretinoin')
  );
}

/**
 * Генерирует 28-дневный план на основе профиля и ответов анкеты
 */
async function generate28DayPlan(userId: string): Promise<GeneratedPlan> {
  console.log(`📊 Generating plan for user ${userId}...`);
  
  // Получаем профиль кожи
  console.log(`🔍 Looking for skin profile for user ${userId}...`);
  const profile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!profile) {
    console.error(`❌ No skin profile found for user ${userId}`);
    throw new Error('No skin profile found');
  }
  
  console.log(`✅ Skin profile found:`, {
    profileId: profile.id,
    skinType: profile.skinType,
    version: profile.version,
  });

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

  // Шаг 1: Классификация профиля (улучшенная логика)
  const goals = Array.isArray(answers.skin_goals) ? answers.skin_goals : [];
  const concerns = Array.isArray(answers.skin_concerns) ? answers.skin_concerns : [];
  
  const profileClassification = {
    focus: goals.filter((g: string) => 
      ['Акне и высыпания', 'Сократить видимость пор', 'Выровнять пигментацию', 'Морщины и мелкие линии'].includes(g)
    ),
    skinType: profile.skinType || 'normal',
    concerns: concerns,
    ageGroup: profile.ageGroup || '25-34',
    exclude: Array.isArray(answers.exclude_ingredients) ? answers.exclude_ingredients : [],
    budget: answers.budget || 'средний',
    pregnant: profile.hasPregnancy || false,
    stepsPreference: answers.care_steps || 'средний',
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
  };

  // Определяем основной фокус (приоритет по частоте упоминаний)
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

  // Шаг 2: Фильтрация продуктов
  console.log(`🔍 Filtering products for focus: ${primaryFocus}, skinType: ${profileClassification.skinType}, budget: ${profileClassification.budget}`);
  
  // Получаем все опубликованные продукты
  let allProducts = await prisma.product.findMany({
    where: { status: 'published' },
    include: { brand: true },
  });

  // Фильтруем продукты по критериям
  const filteredProducts = allProducts.filter(product => {
    // SPF универсален для всех типов кожи - пропускаем проверку типа кожи
    const isSPF = product.step === 'spf' || product.category === 'spf';
    
    // Проверка типа кожи (кроме SPF)
    const skinTypeMatches = isSPF || 
      !product.skinTypes || 
      product.skinTypes.length === 0 || 
      product.skinTypes.includes(profileClassification.skinType);

    // Проверка бюджета (если указан)
    const productPrice = (product as any).price as number | null | undefined;
    const budgetMatches = !profileClassification.budget || 
      profileClassification.budget === 'любой' ||
      !productPrice ||
      getBudgetTier(productPrice) === profileClassification.budget;

    // Проверка исключенных ингредиентов
    const productIngredients = product.concerns || []; // Используем concerns как ингредиенты (можно добавить отдельное поле)
    const noExcludedIngredients = !containsExcludedIngredients(
      productIngredients,
      profileClassification.exclude
    );

    // Проверка беременности (исключаем ретинол)
    const safeForPregnancy = !profileClassification.pregnant || 
      !containsRetinol(productIngredients);

    return skinTypeMatches && budgetMatches && noExcludedIngredients && safeForPregnancy;
  });

  // Сортируем продукты по релевантности (приоритет основному фокусу)
  const sortedProducts = filteredProducts.sort((a, b) => {
    const aMatchesFocus = a.concerns?.includes(primaryFocus) ? 1 : 0;
    const bMatchesFocus = b.concerns?.includes(primaryFocus) ? 1 : 0;
    return bMatchesFocus - aMatchesFocus;
  });

  // Ограничиваем количество продуктов (3 утро + 3 вечер = максимум 6)
  const selectedProducts = sortedProducts.slice(0, 6);
  
  console.log(`✅ Selected ${selectedProducts.length} products after filtering`);

  // Группируем продукты по шагам
  const productsByStep: Record<string, typeof selectedProducts> = {};
  selectedProducts.forEach((product) => {
    const step = product.step || 'other';
    if (!productsByStep[step]) {
      productsByStep[step] = [];
    }
    productsByStep[step].push(product);
  });

  // ГАРАНТИРУЕМ наличие очищения (cleanser) и SPF - они обязательны для всех
  // Если их нет в отфильтрованных продуктах, добавляем отдельно
  
  // Проверяем и добавляем очищение, если его нет
  if (!productsByStep['cleanser'] || productsByStep['cleanser'].length === 0) {
    console.log('⚠️ No cleanser products found, searching for fallback...');
    const whereCleanser: any = {
      status: 'published',
      step: 'cleansing',
    };
    
    // Очищение должно быть доступно, но если есть тип кожи - предпочтем его
    if (profileClassification.skinType) {
      whereCleanser.OR = [
        { skinTypes: { has: profileClassification.skinType } },
        { skinTypes: { isEmpty: true } },
      ];
    }
    
    const fallbackCleanser = await prisma.product.findFirst({
      where: whereCleanser,
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (fallbackCleanser) {
      if (!productsByStep['cleanser']) {
        productsByStep['cleanser'] = [];
      }
      productsByStep['cleanser'].push(fallbackCleanser);
      console.log(`✅ Added fallback cleanser: ${fallbackCleanser.name}`);
    } else {
      // Если даже с фильтром не нашли, берем любой очищающий продукт
      const anyCleanser = await prisma.product.findFirst({
        where: {
          status: 'published',
          step: 'cleansing',
        },
        include: { brand: true },
        orderBy: { createdAt: 'desc' },
      });
      
      if (anyCleanser) {
        if (!productsByStep['cleanser']) {
          productsByStep['cleanser'] = [];
        }
        productsByStep['cleanser'].push(anyCleanser);
        console.log(`✅ Added any available cleanser: ${anyCleanser.name}`);
      }
    }
  }

  // Проверяем и добавляем SPF, если его нет (SPF универсален для всех)
  if (!productsByStep['spf'] || productsByStep['spf'].length === 0) {
    console.log('⚠️ No SPF products found, searching for fallback...');
    const fallbackSPF = await prisma.product.findFirst({
      where: {
        status: 'published',
        OR: [
          { step: 'spf' },
          { category: 'spf' },
        ],
        // SPF универсален - не фильтруем по типу кожи
      },
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (fallbackSPF) {
      if (!productsByStep['spf']) {
        productsByStep['spf'] = [];
      }
      productsByStep['spf'].push(fallbackSPF);
      console.log(`✅ Added fallback SPF: ${fallbackSPF.name}`);
    }
  }

  // Определяем базовые шаги на основе предпочтений
  // Умывание (cleanser) и SPF обязательны для всех
  let maxSteps = 3;
  if (profileClassification.stepsPreference && typeof profileClassification.stepsPreference === 'string') {
    if (profileClassification.stepsPreference.includes('Минимум')) maxSteps = 2;
    else if (profileClassification.stepsPreference.includes('Средний')) maxSteps = 4;
    else if (profileClassification.stepsPreference.includes('Максимум')) maxSteps = 5;
  }

  // Базовые шаги: умывание всегда первое, SPF всегда в утреннем уходе
  const baseSteps = ['cleanser', 'toner', 'treatment', 'moisturizer', 'spf'].slice(0, maxSteps);
  
  // Убеждаемся, что SPF всегда включен в утренний уход (если есть в базовых шагах или добавляем отдельно)
  if (!baseSteps.includes('spf')) {
    baseSteps.push('spf'); // Добавляем SPF, если его нет
  }
  
  // Шаг 3: Генерация плана (28 дней, 4 недели)
  const weeks: PlanWeek[] = [];
  
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const days: PlanDay[] = [];
    
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const day = (weekNum - 1) * 7 + dayNum;
      
      // Постепенное введение продуктов (неделя 1: базовое, неделя 2+: активы)
      // Умывание (cleanser) и SPF всегда в утреннем уходе с первой недели
      const baseStepsWithoutSPF = baseSteps.filter(s => s !== 'spf');
      const morningStepsCount = Math.min(2 + Math.floor((weekNum - 1) / 2), baseStepsWithoutSPF.length);
      const morningSteps = ['cleanser', ...baseStepsWithoutSPF.slice(0, morningStepsCount - 1), 'spf'].filter((v, i, a) => a.indexOf(v) === i);
      const eveningStepsCount = Math.min(3 + Math.floor((weekNum - 1) / 2), baseStepsWithoutSPF.length);
      const eveningSteps = ['cleanser', ...baseStepsWithoutSPF.slice(0, eveningStepsCount - 1)].filter((v, i, a) => a.indexOf(v) === i);
      
      // Убираем SPF из вечернего ухода (он только утром)
      const eveningStepsFiltered = eveningSteps.filter(s => s !== 'spf');
      
      // Собираем продукты для дня
      const dayProducts: Record<string, any> = {};
      [...morningSteps, ...eveningStepsFiltered].forEach((step) => {
        if (productsByStep[step] && productsByStep[step].length > 0) {
          // Выбираем первый продукт для каждого шага (можно добавить ротацию)
          dayProducts[step] = {
            id: productsByStep[step][0].id,
            name: productsByStep[step][0].name,
            brand: productsByStep[step][0].brand.name,
            step: step,
          };
        }
      });
      
      // Убеждаемся, что очищение (cleanser) и SPF всегда включены в шаги, даже если продуктов нет
      // Очищение должно быть и утром, и вечером
      if (!morningSteps.includes('cleanser')) {
        morningSteps.unshift('cleanser');
      }
      if (!eveningStepsFiltered.includes('cleanser')) {
        eveningStepsFiltered.unshift('cleanser');
      }
      
      // SPF только утром
      if (!morningSteps.includes('spf')) {
        morningSteps.push('spf');
      }
      
      days.push({
        day,
        week: weekNum,
        // Очищение и SPF всегда в списке шагов, даже если продукта нет
        morning: morningSteps.filter(s => {
          // Очищение и SPF всегда показываем
          if (s === 'cleanser' || s === 'spf') return true;
          // Остальные - только если есть продукты
          return productsByStep[s]?.length > 0;
        }),
        evening: eveningStepsFiltered.filter(s => {
          // Очищение всегда показываем
          if (s === 'cleanser') return true;
          // Остальные - только если есть продукты
          return productsByStep[s]?.length > 0;
        }),
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

  // Шаг 4: Генерация инфографики (динамическая на основе проблем)
  const progressMetrics: Record<string, number[]> = {
    acne: [25, 45, 70, 90],
    pores: [20, 40, 65, 85],
    hydration: [30, 55, 80, 95],
    pigmentation: [15, 30, 55, 80],
    wrinkles: [10, 25, 50, 75],
  };

  // Определяем актуальные метрики на основе проблем
  const activeMetrics: string[] = [];
  if (primaryFocus === 'acne') activeMetrics.push('acne');
  if (primaryFocus === 'pores') activeMetrics.push('pores');
  if (concerns.includes('Сухость')) activeMetrics.push('hydration');
  if (primaryFocus === 'pigmentation') activeMetrics.push('pigmentation');
  if (primaryFocus === 'wrinkles') activeMetrics.push('wrinkles');

  // Если нет активных метрик, используем общие
  if (activeMetrics.length === 0) {
    activeMetrics.push('hydration', 'pores');
  }

  const infographicProgress = [1, 2, 3, 4].map(week => ({
    week,
    acne: primaryFocus === 'acne' ? progressMetrics.acne[week - 1] : 0,
    pores: primaryFocus === 'pores' ? progressMetrics.pores[week - 1] : 0,
    hydration: concerns.includes('Сухость') ? progressMetrics.hydration[week - 1] : 50,
    pigmentation: primaryFocus === 'pigmentation' ? progressMetrics.pigmentation[week - 1] : 0,
    wrinkles: primaryFocus === 'wrinkles' ? progressMetrics.wrinkles[week - 1] : 0,
  }));

  // Конфигурация графика для Chart.js
  const chartConfig = {
    type: 'line',
    data: {
      labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
      datasets: activeMetrics.map((metric, idx) => ({
        label: {
          acne: 'Акне',
          pores: 'Поры',
          hydration: 'Увлажнение',
          pigmentation: 'Пигментация',
          wrinkles: 'Морщины',
        }[metric] || metric,
        data: infographicProgress.map(p => (p as any)[metric]),
        borderColor: [
          '#0A5F59', // Зеленый
          '#0891B2', // Синий
          '#7C3AED', // Фиолетовый
          '#EC4899', // Розовый
          '#F59E0B', // Оранжевый
        ][idx % 5],
        backgroundColor: 'transparent',
        tension: 0.4,
      })),
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return value + '%';
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
        },
      },
    },
  };

  // Форматируем продукты для карусели
  const formattedProducts = selectedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand.name,
    category: p.category,
    price: (p as any).price || 0,
    available: (p.marketLinks as any)?.ozon ? 'Ozon' : 
               (p.marketLinks as any)?.wb ? 'Wildberries' :
               (p.marketLinks as any)?.apteka ? 'Apteka.ru' :
               'Доступно в аптеках',
    imageUrl: p.imageUrl || undefined,
    ingredients: p.concerns || [], // Используем concerns как ингредиенты (можно добавить отдельное поле)
  }));

  // Генерируем предупреждения об аллергиях и исключениях
  const warnings: string[] = [];
  if (profileClassification.pregnant) {
    warnings.push('⚠️ Во время беременности исключены продукты с ретинолом');
  }
  if (profileClassification.exclude.length > 0) {
    warnings.push(`⚠️ Исключены ингредиенты: ${profileClassification.exclude.join(', ')}`);
  }
  if (profileClassification.allergies.length > 0) {
    warnings.push(`⚠️ Учитываются аллергии: ${profileClassification.allergies.join(', ')}`);
  }

  return {
    profile: {
      skinType: profile.skinType || 'normal',
      sensitivityLevel: profile.sensitivityLevel || 'low',
      acneLevel: profile.acneLevel || null,
      primaryFocus,
      concerns: concerns.slice(0, 3),
      ageGroup: profile.ageGroup || '25-34',
    },
    weeks,
    infographic: {
      progress: infographicProgress,
      chartConfig,
    },
    products: formattedProducts,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function GET(request: NextRequest) {
  console.log('🚀 Plan generation request received');
  
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      console.error('❌ No initData provided');
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const { getUserIdFromInitData } = await import('@/lib/get-user-from-initdata');
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      console.error('❌ Invalid or expired initData');
      return NextResponse.json(
        { error: 'Invalid or expired Telegram initData' },
        { status: 401 }
      );
    }

    console.log('✅ User identified from initData, userId:', userId);
    
    // Получаем профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });

    if (!profile) {
      console.error('❌ No skin profile found for user ${userId}');
      return NextResponse.json(
        { error: 'No skin profile found' },
        { status: 404 }
      );
    }

    // Проверяем кэш
    console.log('🔍 Checking cache for plan...');
    const cachedPlan = await getCachedPlan(userId, profile.version);
    if (cachedPlan) {
      console.log('✅ Plan retrieved from cache');
      return NextResponse.json(cachedPlan);
    }

    console.log('📋 Starting plan generation for userId:', userId);
    const plan = await generate28DayPlan(userId);
    
    // Сохраняем в кэш
    console.log('💾 Caching plan...');
    await setCachedPlan(userId, profile.version, plan);
    
    console.log('✅ Plan generated successfully:', {
      weeksCount: plan.weeks?.length || 0,
      productsCount: plan.products?.length || 0,
      profile: plan.profile?.skinType || 'unknown',
      warnings: plan.warnings?.length || 0,
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
