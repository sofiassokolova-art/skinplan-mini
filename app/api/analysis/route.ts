// API endpoint для получения данных анализа кожи

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateSkinAxes } from '@/lib/skin-analysis-engine';
import type { QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { calculateSkinIssues } from '@/lib/skin-issues';

// Тело функции вынесено в lib/skin-issues.ts, чтобы plan-generator
// импортировал её оттуда, а не через '@/app/api/analysis/route'.

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/analysis';
  let userId: string | null | undefined;
  
  try {
    logger.info('📥 Analysis request started', { timestamp: new Date().toISOString() });

    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;
    
    logger.info('User identified for analysis', { userId });

    // Получаем профиль
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'No skin profile found' },
        { status: 404 }
      );
    }

    // Получаем пользователя для имени
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        firstName: true, 
        lastName: true,
      },
    });

    // Получаем ответы пользователя для расчета проблем
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Извлекаем пол и возраст из ответов
    let gender: string | null = null;
    let age: number | null = null;
    
    for (const answer of userAnswers) {
      const code = answer.question?.code || '';
      const rawValue = answer.answerValue || 
        (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
      
      // Проверяем, что значение - строка
      if (!rawValue || typeof rawValue !== 'string') {
        continue;
      }
      
      const value = rawValue as string;
      
      if (code === 'gender' && value) {
        // Преобразуем "Женский" -> "female", "Мужской" -> "male"
        const lowerValue = value.toLowerCase();
        gender = lowerValue.includes('женск') ? 'female' : 
                 lowerValue.includes('мужск') ? 'male' : lowerValue;
      } else if (code === 'age' && value) {
        // Преобразуем возраст из строки в число (берем середину диапазона или первую цифру)
        // "18–24" -> 21, "25–34" -> 30, "45+" -> 47
        if (value.includes('–')) {
          const parts = value.split('–');
          const min = parseInt(parts[0]?.trim() || '0');
          const max = parseInt(parts[1]?.trim() || '0');
          if (!isNaN(min) && !isNaN(max)) {
            age = Math.floor((min + max) / 2);
          }
        } else if (value.includes('+')) {
          const numStr = value.replace('+', '').trim();
          const num = parseInt(numStr);
          if (!isNaN(num)) {
            age = num + 2;
          }
        } else if (value.includes('До')) {
          age = 16; // "До 18 лет"
        } else {
          const numMatch = value.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0]);
            if (!isNaN(num)) {
              age = num;
            }
          }
        }
      }
    }

    // Вычисляем skin scores
    const questionnaireAnswers: QuestionnaireAnswers = {
      skinType: profile.skinType || 'normal',
      age: profile.ageGroup || '25-34',
      concerns: [],
      diagnoses: [],
      allergies: [],
      seasonChange: undefined,
      habits: [],
      retinolReaction: undefined,
      pregnant: profile.hasPregnancy || false,
      spfFrequency: undefined,
      sunExposure: undefined,
      sensitivityLevel: profile.sensitivityLevel || 'low',
      acneLevel: profile.acneLevel || 0,
    };

    // Извлекаем данные из ответов
    for (const answer of userAnswers) {
      const code = answer.question?.code || '';
      const value = answer.answerValue || 
        (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
      
      if (code === 'skin_concerns' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.concerns = answer.answerValues as string[];
      } else if (code === 'diagnoses' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.diagnoses = answer.answerValues as string[];
      } else if (code === 'habits' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.habits = answer.answerValues as string[];
      } else if (code === 'spf_frequency') {
        questionnaireAnswers.spfFrequency = value as string;
      } else if (code === 'sun_exposure') {
        questionnaireAnswers.sunExposure = value as string;
      } else if (code === 'skin_shine_time') {
        questionnaireAnswers.skinShineTime = value as string;
      } else if (code === 'current_medications' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.currentMedications = answer.answerValues as string[];
      }
    }

    const skinScores = calculateSkinAxes(questionnaireAnswers);

    // Вычисляем проблемы кожи
    const issues = calculateSkinIssues(profile, userAnswers, skinScores);

    // Получаем ключевые проблемы для профиля
    const keyProblems = issues
      .filter(i => i.severity_label === 'критично' || i.severity_label === 'плохо')
      .map(i => i.name);

    // Преобразуем тип кожи в русский
    const skinTypeRuMap: Record<string, string> = {
      dry: 'Сухая',
      oily: 'Жирная',
      combo: 'Комбинированная',
      normal: 'Нормальная',
      sensitive: 'Чувствительная',
    };

    // Получаем рекомендации через API рекомендаций
    let morningSteps: any[] = [];
    let eveningSteps: any[] = [];
    
    try {
      // Создаем внутренний запрос к API рекомендаций
      const recommendationsRequest = new NextRequest(request.url.replace('/analysis', '/recommendations'), {
        headers: request.headers,
      });
      
      // Используем динамический импорт для избежания циклических зависимостей
      const { GET: getRecommendations } = await import('../recommendations/route');
      const recommendationsResponse = await getRecommendations(recommendationsRequest);
      
      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        
        // Преобразуем рекомендации в формат CareStep
        // Примечание: в recommendations API treatment и essence нормализуются в serum,
        // поэтому нам нужно проверять оригинальный step продукта для определения типа
        const stepMapping: Record<string, { name: string; description: string; tags: string[]; isMorning: boolean }> = {
          cleanser: { name: 'Очищение', description: 'Мягкое очищение кожи от загрязнений', tags: ['мягкое очищение'], isMorning: true },
          toner: { name: 'Тоник', description: 'Балансирование pH и подготовка кожи', tags: ['увлажнение'], isMorning: true },
          serum: { name: 'Сыворотка', description: 'Интенсивное увлажнение и питание кожи', tags: ['активные компоненты'], isMorning: false }, // По умолчанию вечер, но может быть и утром
          treatment: { name: 'Активное средство', description: 'Интенсивное воздействие на проблемы кожи', tags: ['активные компоненты'], isMorning: false },
          essence: { name: 'Эссенция', description: 'Увлажнение и подготовка кожи', tags: ['увлажнение'], isMorning: true },
          acid: { name: 'Кислоты', description: 'Отшелушивание и обновление кожи', tags: ['отшелушивание'], isMorning: false },
          moisturizer: { name: 'Увлажнение', description: 'Легкое увлажнение без ощущения тяжести', tags: ['увлажнение'], isMorning: true },
          spf: { name: 'SPF защита', description: 'Защита от УФ-излучения и преждевременного старения', tags: ['защита от УФ', 'предотвращение старения'], isMorning: true },
          lip_care: { name: 'Бальзам для губ', description: 'Уход за губами и защита от сухости', tags: ['уход за губами'], isMorning: true },
        };
        
        if (recommendationsData.steps) {
          let morningStepNumber = 1;
          let eveningStepNumber = 1;
          
          for (const [stepKey, products] of Object.entries(recommendationsData.steps)) {
            if (!Array.isArray(products) || products.length === 0) {
              continue;
            }
            
            // Проверяем оригинальный step продукта, чтобы понять, утренний он или вечерний
            // Утренние шаги: cleanser, toner, essence, moisturizer, spf
            // Вечерние шаги: cleanser (двойное очищение), treatment, serum (если step = 'serum' или 'treatment'), acid, moisturizer
            const isMorningStep = stepKey === 'cleanser' || 
                                 stepKey === 'toner' || 
                                 stepKey === 'essence' || 
                                 stepKey === 'moisturizer' || 
                                 stepKey === 'spf';
            
            const isEveningStep = stepKey === 'cleanser' || // двойное очищение
                                 stepKey === 'serum' || 
                                 stepKey === 'treatment' || 
                                 stepKey === 'acid' || 
                                 stepKey === 'moisturizer';
            
            // Определяем реальный тип шага на основе оригинального step продукта
            // Если stepKey = 'serum', но продукт имеет step = 'treatment' или 'essence', используем это
            const firstProduct = products[0];
            const actualStep = firstProduct?.step || stepKey;
            
            // Если actualStep = 'treatment' или 'essence', но stepKey = 'serum', используем actualStep
            const stepToUse = (actualStep === 'treatment' || actualStep === 'essence') ? actualStep : stepKey;
            
            const stepInfo = stepMapping[stepToUse] || stepMapping[stepKey];
            if (!stepInfo) {
              // Если шаг не найден в маппинге, пропускаем или создаем базовый
              logger.warn(`Unknown step in recommendations: ${stepKey}, actual step: ${actualStep}`);
              continue;
            }
            
            // Определяем, утренний или вечерний шаг на основе реального типа
            let finalIsMorning = stepInfo.isMorning;
            if (stepToUse === 'serum' || stepToUse === 'treatment') {
              // Для serum/treatment определяем по оригинальному step
              finalIsMorning = actualStep === 'essence';
            } else if (stepToUse === 'cleanser') {
              // Cleanser может быть и утром, и вечером - определяем по контексту
              // Если уже есть cleanser в утренних - это вечерний (двойное очищение)
              const hasMorningCleanser = morningSteps.some(s => s.stepName === 'Очищение');
              finalIsMorning = !hasMorningCleanser;
            }
            
              // Ограничиваем до 3 продуктов на шаг (как в ТЗ)
              const productsToShow = Array.isArray(products) ? products.slice(0, 3) : [];
              const formattedProducts = productsToShow.map((p: any) => ({
                id: p.id,
                name: p.name,
                brand: { name: p.brand || (typeof p.brand === 'object' ? p.brand?.name : 'Unknown') },
                imageUrl: p.imageUrl || null,
                description: p.description || p.descriptionUser || '',
                tags: p.tags || (p.concerns || []).slice(0, 2), // Используем теги продукта или concerns
              }));
            
            const careStep = {
              stepNumber: finalIsMorning ? morningStepNumber++ : eveningStepNumber++,
              stepName: stepInfo.name,
              stepDescription: stepInfo.description,
              stepTags: stepInfo.tags,
              products: formattedProducts,
            };
            
            if (finalIsMorning) {
              morningSteps.push(careStep);
            } else {
              eveningSteps.push(careStep);
            }
          }
          
          // Сортируем шаги по порядку (утренние: очищение -> тоник -> эссенция -> сыворотка -> увлажнение -> SPF)
          // (вечерние: очищение -> кислоты -> сыворотка -> увлажнение)
          const morningOrder = ['Очищение', 'Тоник', 'Эссенция', 'Сыворотка', 'Увлажнение', 'SPF защита'];
          const eveningOrder = ['Очищение', 'Кислоты', 'Активное средство', 'Сыворотка', 'Увлажнение'];
          
          morningSteps.sort((a, b) => {
            const indexA = morningOrder.indexOf(a.stepName);
            const indexB = morningOrder.indexOf(b.stepName);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
          
          eveningSteps.sort((a, b) => {
            const indexA = eveningOrder.indexOf(a.stepName);
            const indexB = eveningOrder.indexOf(b.stepName);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
          
          // Перенумеровываем после сортировки
          morningSteps.forEach((step, index) => {
            step.stepNumber = index + 1;
          });
          eveningSteps.forEach((step, index) => {
            step.stepNumber = index + 1;
          });
        }
      }
    } catch (recError: any) {
      logger.warn('Could not load recommendations for analysis', {
        error: recError?.message || String(recError),
        stack: recError?.stack,
      });
      // Продолжаем без рекомендаций
    }

    const duration = Date.now() - startTime;
    logger.info('✅ Analysis data generated successfully', {
      userId,
      issuesCount: issues.length,
      morningStepsCount: morningSteps.length,
      eveningStepsCount: eveningSteps.length,
      keyProblemsCount: keyProblems.length,
      duration,
    });
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      profile: {
        gender: gender || null,
        age: age || null,
        skinType: profile.skinType || 'normal',
        skinTypeRu: skinTypeRuMap[profile.skinType || 'normal'] || 'Нормальная',
        keyProblems,
      },
      issues,
      morningSteps,
      eveningSteps,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('❌ Error getting analysis data', error, {
      userId,
      duration,
    });
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


