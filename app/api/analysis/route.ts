// app/api/analysis/route.ts
// API endpoint для получения данных анализа кожи

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateSkinAxes } from '@/lib/skin-analysis-engine';
import type { QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

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
export function calculateSkinIssues(
  profile: any,
  userAnswers: any[],
  skinScores: any[]
): SkinIssue[] {
  const issues: SkinIssue[] = [];
  
  // Получаем ответы в удобном формате
  const answersMap: Record<string, any> = {};
  for (const answer of userAnswers) {
    const questionCode = answer.question?.code || '';

    // Для multi-choice вопросов берем лейблы опций, для single-choice - лейбл опции
    if (answer.answerValues && Array.isArray(answer.answerValues) && answer.answerValues.length > 0) {
      // Для multi-choice - массив лейблов опций
      const labels: string[] = [];
      for (const value of answer.answerValues) {
        const option = answer.question?.answerOptions?.find(opt => opt.value === value);
        if (option?.label) {
          labels.push(option.label);
        } else {
          // Fallback на value, если лейбл не найден
          labels.push(String(value));
        }
      }
      answersMap[questionCode] = labels;
    } else if (answer.answerValue) {
      // Для single-choice - лейбл опции или само значение
      const option = answer.question?.answerOptions?.find(opt => opt.value === answer.answerValue);
      answersMap[questionCode] = option?.label || answer.answerValue;
    }
  }

  // 1. Акне / высыпания (согласно ТЗ)
  const acneConcern = answersMap.skin_concerns?.some((c: string) =>
    c.includes('Акне') || c.includes('высыпания') || c.includes('acne') || c.includes('акне')
  );
  const acneDiagnosis = answersMap.medical_diagnoses?.includes('acne') ||
                        answersMap.medical_diagnoses?.includes('акне');
  const hasIsotretinoin = answersMap.oral_medications?.includes('isotretinoin') ||
                         answersMap.oral_medications?.includes('изотретиноин');
  const acneLevel = profile.acneLevel || 0;
  const hasActiveInflammations = acneLevel >= 4;
  
  // Добавляем проблему акне согласно ТЗ
  if (acneConcern || acneDiagnosis || acneLevel >= 3 || hasIsotretinoin) {
    let severityLabel: string;
    let description: string;
    let tags: string[] = [];
    
    if (hasIsotretinoin || acneDiagnosis) {
      severityLabel = 'критично';
      description = 'Диагноз акне или применение изотретиноина требует особого подхода к уходу';
      tags = ['воспаления', 'постакне'];
    } else if (hasActiveInflammations && acneConcern) {
      severityLabel = 'плохо';
      description = 'Активные воспаления требуют специального ухода и лечения';
      tags = ['воспаления', 'постакне'];
    } else if (acneConcern) {
      severityLabel = 'умеренно';
      description = 'Умеренные высыпания, требующие внимательного подхода';
      tags = ['акне'];
    } else {
      severityLabel = 'хорошо';
      description = 'Минимальные проявления акне';
      tags = [];
    }
    
    issues.push({
      id: 'acne',
      name: 'Акне / высыпания',
      severity_score: hasIsotretinoin ? 95 : 
                     (acneDiagnosis ? 90 : 
                     (hasActiveInflammations ? 75 : 
                     (acneLevel >= 3 ? 60 : 40))),
      severity_label: severityLabel as any,
      description,
      tags,
    });
  }

  // 2. Жирность и блеск кожи (согласно ТЗ)
  const oilinessScore = skinScores.find(s => s.axis === 'oiliness')?.value || 50;
  // Нет прямого вопроса о времени блеска, используем тип кожи
  const shineTime = answersMap.skin_type === 'oily' || answersMap.skin_type === 'combination_oily' ? '2-3_hours' : null;
  
  if (oilinessScore >= 60) {
    let severityLabel: string;
    if (shineTime === '2-3_hours' || shineTime === '2–3 часа') {
      severityLabel = 'плохо';
    } else if (shineTime === 'evening' || shineTime === 'к вечеру') {
      severityLabel = 'умеренно';
    } else {
      severityLabel = 'хорошо';
    }
    
    issues.push({
      id: 'oiliness',
      name: 'Жирность и блеск кожи',
      severity_score: oilinessScore,
      severity_label: severityLabel as any,
      description: shineTime === '2-3_hours' || shineTime === '2–3 часа'
        ? 'Блеск появляется через 2–3 часа, требуется контроль себума'
        : 'Избыточное выделение кожного сала',
      tags: ['Т-зона', 'блеск'],
    });
  }

  // 3. Сухость/стянутость
  const hydrationScore = skinScores.find(s => s.axis === 'hydration')?.value || 100;
  if (hydrationScore <= 60) {
    const hasAtopic = answersMap.medical_diagnoses?.includes('atopic_dermatitis') ||
                     answersMap.medical_diagnoses?.includes('атопический дерматит');
    const hasTightness = answersMap.skin_concerns?.some((c: string) =>
      c.includes('Сухость') || c.includes('стянутость') || c.includes('dehydration') || c.includes('обезвоженность')
    ) || answersMap.skin_type === 'dry' || answersMap.skin_type === 'combination_dry';
    
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

  // 5. Морщины (согласно ТЗ: возраст + жалоба)
  const ageGroup = profile.ageGroup || '';
  const photoagingScore = skinScores.find(s => s.axis === 'photoaging')?.value || 0;
  const hasWrinkleConcern = answersMap.skin_concerns?.some((c: string) =>
    c.includes('Морщины') || c.includes('wrinkles') || c.includes('морщины')
  );
  
  // Добавляем проблему морщин, если есть возраст + жалоба (согласно ТЗ)
  if (hasWrinkleConcern) {
    const isOlderAge = ageGroup.includes('40') || ageGroup.includes('50') || ageGroup.includes('45');
    issues.push({
      id: 'wrinkles',
      name: 'Морщины',
      severity_score: Math.max(photoagingScore, isOlderAge ? 70 : 50),
      severity_label: (isOlderAge && photoagingScore >= 60) ? 'плохо' : 'умеренно',
      description: isOlderAge 
        ? 'Признаки старения требуют интенсивного антивозрастного ухода'
        : 'Признаки старения требуют антивозрастного ухода',
      tags: ['старение', 'антивозрастной уход'],
    });
  }

  // 6. Краснота, раздражение, чувствительность
  const sensitivityLevel = profile.sensitivityLevel || 'low';
  const rednessScore = skinScores.find(s => s.axis === 'redness')?.value || 50;
  const hasRosacea = answersMap.medical_diagnoses?.includes('rosacea') ||
                    answersMap.medical_diagnoses?.includes('розацеа');
  const hasDermatitis = answersMap.medical_diagnoses?.includes('dermatitis') ||
                       answersMap.medical_diagnoses?.includes('дерматит');
  
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
  const sleepHabits = answersMap.lifestyle_habits || [];
  const hasSleepIssue = Array.isArray(sleepHabits) && 
                       sleepHabits.some((h: string) => h.includes('недосып') || h.includes('мало сплю'));
  const hasDarkCircles = answersMap.skin_concerns?.some((c: string) =>
    c.includes('темные круги') || c.includes('dark_circles') || c.includes('круги под глазами')
  );
  
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

  // Сортируем проблемы по приоритету согласно ТЗ:
  // 1. Сначала критичные проблемы (критично/плохо)
  // 2. Затем умеренные (умеренно)
  // 3. В конце те, что в норме (хорошо/отлично)
  const severityOrder: Record<string, number> = {
    'критично': 0,
    'плохо': 1,
    'умеренно': 2,
    'хорошо': 3,
    'отлично': 4,
  };

  return issues.sort((a, b) => {
    const orderA = severityOrder[a.severity_label] ?? 5;
    const orderB = severityOrder[b.severity_label] ?? 5;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Если severity одинаковый, сортируем по score (выше = важнее)
    return b.severity_score - a.severity_score;
  });
}

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


