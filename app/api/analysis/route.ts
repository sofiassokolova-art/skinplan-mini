// app/api/analysis/route.ts
// API endpoint для получения данных анализа кожи

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { calculateSkinAxes } from '@/lib/skin-analysis-engine';
import type { QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { logger } from '@/lib/logger';

interface SkinIssue {
  id: string;
  name: string;
  severity_score: number;
  severity_label: 'критично' | 'плохо' | 'умеренно' | 'хорошо' | 'отлично';
  description: string;
  tags: string[];
  image_url?: string;
}

/**
 * Вычисляет проблемы кожи на основе профиля и ответов
 */
function calculateSkinIssues(
  profile: any,
  userAnswers: any[],
  skinScores: any[]
): SkinIssue[] {
  const issues: SkinIssue[] = [];
  
  // Получаем ответы в удобном формате
  const answersMap: Record<string, any> = {};
  for (const answer of userAnswers) {
    const questionCode = answer.question?.code || '';
    const value = answer.answerValue || 
      (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
    answersMap[questionCode] = value;
  }

  // 1. Акне / высыпания
  const acneLevel = profile.acneLevel || 0;
  if (acneLevel >= 3) {
    const hasDiagnosis = answersMap.diagnoses?.includes('acne') || 
                        answersMap.diagnoses?.includes('акне');
    const hasIsotretinoin = answersMap.current_medications?.includes('isotretinoin') ||
                           answersMap.current_medications?.includes('изотретиноин');
    
    issues.push({
      id: 'acne',
      name: 'Акне / высыпания',
      severity_score: acneLevel * 20,
      severity_label: (hasDiagnosis || hasIsotretinoin) ? 'критично' : 
                     acneLevel >= 4 ? 'плохо' : 'умеренно',
      description: acneLevel >= 4 
        ? 'Активные воспаления требуют специального ухода и лечения'
        : 'Умеренные высыпания, требующие внимательного подхода',
      tags: ['воспаления', acneLevel >= 4 ? 'постакне' : 'акне'],
    });
  }

  // 2. Жирность и блеск кожи
  const oilinessScore = skinScores.find(s => s.axis === 'oiliness')?.value || 50;
  if (oilinessScore >= 60) {
    const shineTime = answersMap.skin_shine_time;
    issues.push({
      id: 'oiliness',
      name: 'Жирность и блеск кожи',
      severity_score: oilinessScore,
      severity_label: shineTime === '2-3_hours' ? 'плохо' : 
                     shineTime === 'evening' ? 'умеренно' : 'хорошо',
      description: 'Избыточное выделение кожного сала',
      tags: ['Т-зона', 'блеск'],
    });
  }

  // 3. Сухость/стянутость
  const hydrationScore = skinScores.find(s => s.axis === 'hydration')?.value || 100;
  if (hydrationScore <= 60) {
    const hasAtopic = answersMap.diagnoses?.includes('atopic_dermatitis') ||
                     answersMap.diagnoses?.includes('атопический дерматит');
    const hasTightness = answersMap.skin_concerns?.includes('tightness') ||
                        answersMap.skin_concerns?.includes('стянутость');
    
    issues.push({
      id: 'dryness',
      name: 'Сухость/стянутость',
      severity_score: 100 - hydrationScore,
      severity_label: hasAtopic ? 'критично' :
                     (hasTightness && hydrationScore <= 40) ? 'плохо' : 'умеренно',
      description: hasAtopic 
        ? 'Атопический дерматит требует особого ухода'
        : 'Кожа нуждается в дополнительном увлажнении',
      tags: ['сухость', hasAtopic ? 'атопия' : 'обезвоженность'],
    });
  }

  // 4. Неровный тон / пигментация
  const pigmentationScore = skinScores.find(s => s.axis === 'pigmentation')?.value || 50;
  const spfFrequency = answersMap.spf_frequency;
  const sunExposure = answersMap.sun_exposure;
  if (pigmentationScore >= 40 || (spfFrequency === 'never' && sunExposure === 'more_than_3_hours')) {
    issues.push({
      id: 'pigmentation',
      name: 'Неровный тон / пигментация',
      severity_score: pigmentationScore,
      severity_label: pigmentationScore >= 60 ? 'плохо' : 'умеренно',
      description: 'Неравномерная пигментация требует защиты от УФ и осветляющих средств',
      tags: ['пигментация', 'SPF'],
    });
  }

  // 5. Морщины
  const ageGroup = profile.ageGroup || '';
  const wrinklesScore = skinScores.find(s => s.axis === 'wrinkles')?.value || 50;
  const hasWrinkleConcern = answersMap.skin_concerns?.includes('wrinkles') ||
                           answersMap.skin_concerns?.includes('морщины');
  if ((ageGroup.includes('40') || ageGroup.includes('50') || wrinklesScore >= 40) && hasWrinkleConcern) {
    issues.push({
      id: 'wrinkles',
      name: 'Морщины',
      severity_score: wrinklesScore,
      severity_label: wrinklesScore >= 60 ? 'плохо' : 'умеренно',
      description: 'Признаки старения требуют антивозрастного ухода',
      tags: ['старение', 'антивозрастной уход'],
    });
  }

  // 6. Краснота, раздражение, чувствительность
  const sensitivityLevel = profile.sensitivityLevel || 'low';
  const rednessScore = skinScores.find(s => s.axis === 'redness')?.value || 50;
  const hasRosacea = answersMap.diagnoses?.includes('rosacea') ||
                    answersMap.diagnoses?.includes('розацеа');
  const hasDermatitis = answersMap.diagnoses?.includes('dermatitis') ||
                       answersMap.diagnoses?.includes('дерматит');
  
  if (sensitivityLevel === 'high' || sensitivityLevel === 'very_high' || 
      rednessScore >= 50 || hasRosacea || hasDermatitis) {
    issues.push({
      id: 'sensitivity',
      name: 'Краснота, раздражение, чувствительность',
      severity_score: Math.max(rednessScore, hasRosacea || hasDermatitis ? 80 : 60),
      severity_label: (hasRosacea || hasDermatitis) ? 'критично' :
                     (sensitivityLevel === 'high' || sensitivityLevel === 'very_high') ? 'плохо' : 'умеренно',
      description: 'Повышенная чувствительность кожи требует мягкого ухода',
      tags: ['раздражение', hasRosacea ? 'розацеа' : 'чувствительность'],
    });
  }

  // 7. Расширенные поры
  if (oilinessScore >= 50) {
    issues.push({
      id: 'pores',
      name: 'Расширенные поры',
      severity_score: oilinessScore,
      severity_label: oilinessScore >= 70 ? 'плохо' : 'умеренно',
      description: 'Расширенные поры связаны с избыточной жирностью',
      tags: ['поры', 'Т-зона'],
    });
  }

  // 8. Зона под глазами
  const sleepHabits = answersMap.habits || [];
  const hasSleepIssue = Array.isArray(sleepHabits) && 
                       sleepHabits.some((h: string) => h.includes('недосып') || h.includes('мало сплю'));
  const hasDarkCircles = answersMap.skin_concerns?.includes('dark_circles') ||
                        answersMap.skin_concerns?.includes('темные круги');
  
  if (hasSleepIssue || hasDarkCircles) {
    issues.push({
      id: 'eye_area',
      name: 'Зона под глазами',
      severity_score: (hasSleepIssue ? 50 : 0) + (hasDarkCircles ? 50 : 0),
      severity_label: (hasSleepIssue && hasDarkCircles) ? 'плохо' : 'умеренно',
      description: 'Темные круги и отеки требуют специального ухода',
      tags: ['темные круги', 'отеки'],
    });
  }

  // 9. Защитный барьер кожи
  const barrierScore = skinScores.find(s => s.axis === 'barrier')?.value || 100;
  if (barrierScore <= 60) {
    const hasBarrierIssue = (sensitivityLevel === 'high' || sensitivityLevel === 'very_high') &&
                           (hydrationScore <= 60);
    issues.push({
      id: 'barrier',
      name: 'Защитный барьер кожи',
      severity_score: 100 - barrierScore,
      severity_label: barrierScore <= 40 ? 'плохо' : 'умеренно',
      description: 'Нарушение защитного барьера требует восстановительного ухода',
      tags: ['барьер', 'восстановление'],
    });
  }

  // 10. UV-риск
  if (spfFrequency === 'never' && sunExposure === 'more_than_3_hours') {
    issues.push({
      id: 'uv_risk',
      name: 'UV-риск',
      severity_score: 80,
      severity_label: 'критично',
      description: 'Отсутствие защиты от УФ-излучения повышает риск фотостарения и пигментации',
      tags: ['SPF', 'фотостарение'],
    });
  }

  return issues;
}

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

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
                price: (p as any).price || 0,
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
  } catch (error) {
    logger.error('Error getting analysis data', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


