// lib/skin-analysis-engine.ts
// Дерматологическая модель оценки кожи (2025) - 6 ключевых осей

export type SkinAxis = 'oiliness' | 'hydration' | 'barrier' | 'inflammation' | 'pigmentation' | 'photoaging';

export interface SkinScore {
  axis: SkinAxis;
  value: number;        // 0–100
  level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  color: string;
}

/**
 * ИСПРАВЛЕНО (P0): Каноническая схема входа для skin-analysis-engine
 * Все значения должны быть нормализованы перед передачей в engine
 * Запрещён доступ к "сырым" answers внутри engine
 */
export interface NormalizedQuestionnaireContext {
  skinType?: string;
  age?: string;
  ageGroup?: string;
  concerns?: string[];
  diagnoses?: string[];
  allergies?: string[];
  seasonality?: 'winter' | 'summer' | 'demi' | 'winter_drier' | 'summer_oilier' | 'stable' | null; // ИСПРАВЛЕНО: канонический ключ
  habits?: string[];
  retinolReaction?: string;
  pregnant?: boolean;
  spfUsage?: 'never' | 'sometimes' | 'daily' | null; // ИСПРАВЛЕНО: канонический ключ
  sunExposure?: string;
  sensitivityLevel?: string;
  acneLevel?: number;
  pigmentationRisk?: string;
}

/**
 * @deprecated Используйте NormalizedQuestionnaireContext
 * Оставлено для обратной совместимости
 */
export interface QuestionnaireAnswers extends NormalizedQuestionnaireContext {
  seasonChange?: string; // Маппится на seasonality
  spfFrequency?: string; // Маппится на spfUsage
  [key: string]: any; // для дополнительных полей
}

/**
 * ИСПРАВЛЕНО (P0): Рассчитывает 6 дерматологических осей кожи
 * Принимает ТОЛЬКО NormalizedQuestionnaireContext
 * null = неизвестно (не "норма")
 */
export function calculateSkinAxes(answers: QuestionnaireAnswers | NormalizedQuestionnaireContext): SkinScore[] {
  // ИСПРАВЛЕНО: Нормализуем входные данные к канонической схеме
  const normalized: NormalizedQuestionnaireContext = {
    skinType: answers.skinType,
    age: answers.age,
    ageGroup: answers.ageGroup,
    concerns: answers.concerns,
    diagnoses: answers.diagnoses,
    allergies: answers.allergies,
    seasonality: answers.seasonality || (answers as any).seasonChange || null, // ИСПРАВЛЕНО: маппинг seasonChange → seasonality
    habits: answers.habits,
    retinolReaction: answers.retinolReaction,
    pregnant: answers.pregnant,
    spfUsage: answers.spfUsage || (answers as any).spfFrequency || null, // ИСПРАВЛЕНО: маппинг spfFrequency → spfUsage
    sunExposure: answers.sunExposure,
    sensitivityLevel: answers.sensitivityLevel,
    acneLevel: answers.acneLevel,
    pigmentationRisk: answers.pigmentationRisk,
  };
  
  const a = normalized; // для краткости

  // ИСПРАВЛЕНО (P0): 1. Oiliness (жирность) - null если данных нет
  const oiliness = (() => {
    // ИСПРАВЛЕНО: Если нет данных о типе кожи - возвращаем null (неизвестно)
    if (!a.skinType) return null;
    
    let score = 50; // нейтральная база (только если есть данные)
    if (a.skinType === 'oily') score += 40;
    if (a.skinType === 'combo' || a.skinType === 'combo_oily') score += 25;
    if (a.skinType === 'dry') score -= 30;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Жирность') || c.includes('блеск'))) score += 30;
    // ИСПРАВЛЕНО: Используем seasonality вместо seasonChange
    if (a.seasonality === 'summer_oilier' || (typeof a.seasonality === 'string' && a.seasonality.includes('лето'))) score += 15;
    return Math.max(0, Math.min(100, score));
  })();

  // ИСПРАВЛЕНО (P0): 2. Hydration + TEWL - null если данных нет
  const hydration = (() => {
    // ИСПРАВЛЕНО: Если нет данных о типе кожи - возвращаем null (неизвестно)
    if (!a.skinType) return null;
    
    let score = 100; // идеальное увлажнение (только если есть данные)
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Сухость') || c.includes('стянутость'))) score -= 40;
    if (a.skinType === 'dry') score -= 35;
    // ИСПРАВЛЕНО: Используем seasonality вместо seasonChange
    if (a.seasonality === 'winter_drier' || (typeof a.seasonality === 'string' && a.seasonality.includes('зима'))) score -= 20;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('не высыпаюсь') || h.includes('мало сплю'))) score -= 15;
    return Math.max(0, Math.min(100, score));
  })();

  // ИСПРАВЛЕНО (P0): 3. Barrier Integrity - null если данных нет
  const barrier = (() => {
    // ИСПРАВЛЕНО: Если нет данных о чувствительности - возвращаем null (неизвестно)
    if (!a.sensitivityLevel && !a.concerns && !a.diagnoses && !a.allergies) return null;
    
    let score = 100; // здоровый барьер (только если есть данные)
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Чувствительность') || c.includes('чувствительна'))) score -= 30;
    if (Array.isArray(a.diagnoses) && a.diagnoses.some((d: string) => d.includes('Атопический') || d.includes('атопия'))) score -= 50;
    if (Array.isArray(a.allergies) && a.allergies.length > 0) score -= 25;
    if (a.retinolReaction === 'irritation' || (typeof a.retinolReaction === 'string' && a.retinolReaction.includes('раздражение'))) score -= 30;
    if (a.sensitivityLevel === 'high') score -= 30;
    return Math.max(0, Math.min(100, score));
  })();

  // ИСПРАВЛЕНО (P0): 4. Inflammation / Acne - null если данных нет
  const inflammation = (() => {
    // ИСПРАВЛЕНО: Если нет данных об акне - возвращаем null (неизвестно)
    if (!a.concerns && !a.diagnoses && !a.habits && (a.acneLevel === undefined || a.acneLevel === null)) return null;
    
    let score = 0;
    const debugInfo: string[] = [];
    
    // Проверяем concerns на акне
    const hasAcneInConcerns = Array.isArray(a.concerns) && a.concerns.some((c: string) => 
      c.includes('Акне') || c.includes('акне') || c.includes('высыпания')
    );
    if (hasAcneInConcerns) {
      score += 50;
      debugInfo.push(`concerns (акне): +50`);
    }
    
    // Проверяем diagnoses на акне
    const hasAcneInDiagnoses = Array.isArray(a.diagnoses) && a.diagnoses.some((d: string) => 
      d.includes('Акне') || d.includes('акне')
    );
    if (hasAcneInDiagnoses) {
      score += 40;
      debugInfo.push(`diagnoses (акне): +40`);
    }
    
    // Проверяем concerns на покраснения
    const hasRednessInConcerns = Array.isArray(a.concerns) && a.concerns.some((c: string) => 
      c.includes('Покраснения') || c.includes('покраснение')
    );
    if (hasRednessInConcerns) {
      score += 25;
      debugInfo.push(`concerns (покраснения): +25`);
    }
    
    // Проверяем habits на сладкое
    const hasSugarInHabits = Array.isArray(a.habits) && a.habits.some((h: string) => 
      h.includes('сладкое') || h.includes('сахар')
    );
    if (hasSugarInHabits) {
      score += 15;
      debugInfo.push(`habits (сладкое): +15`);
    }
    
    // Проверяем habits на стресс
    const hasStressInHabits = Array.isArray(a.habits) && a.habits.some((h: string) => 
      h.includes('Стресс') || h.includes('стресс')
    );
    if (hasStressInHabits) {
      score += 20;
      debugInfo.push(`habits (стресс): +20`);
    }
    
    // Добавляем баллы за уровень акне
    if (a.acneLevel && typeof a.acneLevel === 'number') {
      const acneLevelScore = a.acneLevel * 8;
      score += acneLevelScore;
      debugInfo.push(`acneLevel (${a.acneLevel}): +${acneLevelScore}`);
    }
    
    const finalScore = Math.min(100, score);
    
    // ИСПРАВЛЕНО: Логируем детали вычисления inflammation в development режиме
    if (process.env.NODE_ENV === 'development' && debugInfo.length > 0) {
      console.debug('[skin-analysis-engine] Inflammation calculation:', {
        input: {
          concerns: a.concerns,
          diagnoses: a.diagnoses,
          habits: a.habits,
          acneLevel: a.acneLevel,
        },
        steps: debugInfo,
        rawScore: score,
        finalScore,
      });
    }
    
    return finalScore;
  })();

  // ИСПРАВЛЕНО (P0): 5. Pigmentation Risk - null если данных нет
  const pigmentation = (() => {
    // ИСПРАВЛЕНО: Если нет данных о пигментации - возвращаем null (неизвестно)
    if (!a.concerns && !a.habits && !a.diagnoses && !a.pigmentationRisk) return null;
    
    let score = 0;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Пигментация') || c.includes('пигментация'))) score += 50;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Неровный') || c.includes('тон'))) score += 30;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('солнце без SPF') || h.includes('без защиты'))) score += 40;
    if (Array.isArray(a.diagnoses) && a.diagnoses.some((d: string) => d.includes('Мелазма') || d.includes('мелазма'))) score = 90;
    if (a.pigmentationRisk === 'high') score += 40;
    return Math.min(100, score);
  })();

  // ИСПРАВЛЕНО (P0): 6. Photoaging / Wrinkles - null если данных нет
  const photoaging = (() => {
    // ИСПРАВЛЕНО: Если нет данных о возрасте - возвращаем null (неизвестно)
    if (!a.age && !a.ageGroup) return null;
    
    let score = 0;
    const age = a.age === '45+' || a.ageGroup === '45+' ? 90 : 
                a.age === '35-44' || a.ageGroup === '35-44' ? 70 : 
                a.age === '25-34' || a.ageGroup === '25-34' ? 40 : 10;
    score += age / 2;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Морщины') || c.includes('морщины'))) score += 40;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('солнце без SPF') || h.includes('без защиты'))) score += 30;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('Курю') || h.includes('курю'))) score += 35;
    // ИСПРАВЛЕНО: Используем spfUsage вместо spfFrequency
    if (a.spfUsage === 'never' || (typeof a.spfUsage === 'string' && a.spfUsage.includes('никогда'))) score += 25;
    return Math.min(100, score);
  })();

  // ИСПРАВЛЕНО (P0): Возвращаем оси только если они не null
  // null означает "неизвестно", а не "норма"
  const axes: SkinScore[] = [];
  
  if (oiliness !== null) {
    axes.push({
      axis: 'oiliness',
      value: oiliness,
      level: getLevel(oiliness, true),
      title: 'Жирность',
      description: desc.oiliness(oiliness),
      color: '#10B981',
    });
  }
  
  if (hydration !== null) {
    axes.push({
      axis: 'hydration',
      value: 100 - hydration, // инвертируем: чем меньше увлажнение, тем больше обезвоженность
      level: getLevel(100 - hydration, false),
      title: 'Обезвоженность',
      description: desc.hydration(hydration),
      color: '#3B82F6',
    });
  }
  
  if (barrier !== null) {
    axes.push({
      axis: 'barrier',
      value: barrier,
      level: getLevel(100 - barrier, false), // инвертируем: чем меньше барьер, тем больше проблема
      title: 'Барьер',
      description: desc.barrier(barrier),
      color: '#F59E0B',
    });
  }
  
  if (inflammation !== null) {
    axes.push({
      axis: 'inflammation',
      value: inflammation,
      level: getLevel(inflammation, false),
      title: 'Воспаление',
      description: desc.inflammation(inflammation),
      color: '#EF4444',
    });
  }
  
  if (pigmentation !== null) {
    axes.push({
      axis: 'pigmentation',
      value: pigmentation,
      level: getLevel(pigmentation, false),
      title: 'Пигментация',
      description: desc.pigmentation(pigmentation),
      color: '#8B5CF6',
    });
  }
  
  if (photoaging !== null) {
    axes.push({
      axis: 'photoaging',
      value: photoaging,
      level: getLevel(photoaging, false),
      title: 'Фотостарение',
      description: desc.photoaging(photoaging),
      color: '#EC4899',
    });
  }
  
  return axes;
}

function getLevel(value: number | null, isPositive: boolean): 'low' | 'medium' | 'high' | 'critical' {
  // ИСПРАВЛЕНО (P0): Если value === null, возвращаем 'low' как fallback
  // Но это не должно происходить, т.к. null оси не попадают в результат
  if (value === null) return 'low';
  
  // Для положительных осей (например, жирность) - чем больше, тем выше уровень
  // Для негативных осей (обезвоженность, воспаление) - чем больше, тем выше проблема
  if (value < 30) return 'low';
  if (value < 55) return 'medium';
  if (value < 80) return 'high';
  return 'critical';
}

// Профессиональные описания для инфографики
const desc = {
  oiliness: (v: number) => 
    v > 75 ? 'Очень жирная кожа, склонность к акне' : 
    v > 50 ? 'Комбинированная с жирной Т-зоной' : 
    'Нормальная/сухая',

  hydration: (v: number) => 
    v < 40 ? 'Выраженная обезвоженность, требуется интенсивное увлажнение' : 
    v < 65 ? 'Умеренная обезвоженность' : 
    'Хороший уровень увлажнения',

  barrier: (v: number) => 
    v < 50 ? 'Повреждённый барьер — обязательны церамиды и липиды' : 
    v < 70 ? 'Ослабленный барьер' : 
    'Здоровый барьер',

  inflammation: (v: number) => 
    v > 70 ? 'Активное воспаление — нужен анти-акне протокол' : 
    v > 40 ? 'Умеренное акне' : 
    'Минимальное воспаление',

  pigmentation: (v: number) => 
    v > 70 ? 'Высокий риск пигментации — обязательна защита SPF50+' : 
    v > 50 ? 'Средний риск' : 
    'Низкий риск',

  photoaging: (v: number) => 
    v > 60 ? 'Выраженное фотостарение — ретинол/пептиды' : 
    v > 40 ? 'Начальные признаки' : 
    'Минимальные',
};

/**
 * Получает дерматологические рекомендации на основе осей кожи
 */
export interface DermatologistRecommendations {
  mustHave: Array<{
    name: string;
    brand: string;
    price: number;
    category?: string;
  }>;
  avoid: string[];
  heroActives: string[];
  routineSteps: {
    morning: string[];
    evening: string[];
  };
}

export function getDermatologistRecommendations(
  scores: SkinScore[], 
  answers: QuestionnaireAnswers
): DermatologistRecommendations {
  const recs: DermatologistRecommendations = {
    mustHave: [],
    avoid: [],
    heroActives: [],
    routineSteps: {
      morning: ['cleanser', 'spf'],
      evening: ['cleanser'],
    },
  };

  const inflammationScore = scores.find(s => s.axis === 'inflammation')?.value || 0;
  const pigmentationScore = scores.find(s => s.axis === 'pigmentation')?.value || 0;
  const barrierScore = scores.find(s => s.axis === 'barrier')?.value || 0;
  const hydrationScore = scores.find(s => s.axis === 'hydration')?.value || 0;
  const photoagingScore = scores.find(s => s.axis === 'photoaging')?.value || 0;

  const highInflammation = inflammationScore > 65;
  const highPigmentation = pigmentationScore > 65;
  const damagedBarrier = barrierScore < 50;
  const dehydrated = hydrationScore > 60; // инвертировано: высокое значение = высокая обезвоженность
  const photoagingHigh = photoagingScore > 60;

  // Герои-ингредиенты
  if (highInflammation) {
    recs.heroActives.push('азелаиновая кислота 15–20%', 'ниацинамид 10%', 'центелла');
  }
  if (highPigmentation) {
    recs.heroActives.push('транексамовая кислота', 'ниацинамид 10%', 'витамин С 15–20%');
  }
  if (damagedBarrier) {
    recs.heroActives.push('церамиды', 'пантенол 5%', 'центелла', 'полиглутаминовая кислота');
  }
  if (dehydrated) {
    recs.heroActives.push('гиалуроновая кислота (многослойная)', 'глицерин 10%+', 'сквалан');
  }
  if (photoagingHigh && !answers.pregnant) {
    recs.heroActives.push('ретинол 0.3–1%', 'бакучиол', 'пептиды');
  }

  // Обязательные продукты (российские аптечные + премиум)
  if (highInflammation) {
    recs.mustHave.push(
      { name: 'Azelik 15% гель', brand: 'Акрихин', price: 850, category: 'treatment' },
      { name: 'Baziron AC 5%', brand: 'Galderma', price: 950, category: 'treatment' },
      { name: 'Effaclar Duo(+) M', brand: 'La Roche-Posay', price: 1650, category: 'moisturizer' }
    );
  }

  if (highPigmentation) {
    recs.mustHave.push(
      { name: 'Mela B3 сыворотка', brand: 'La Roche-Posay', price: 3200, category: 'serum' },
      { name: 'Brightening Serum', brand: 'The Ordinary', price: 1450, category: 'serum' }
    );
  }

  if (damagedBarrier) {
    recs.mustHave.push(
      { name: 'Lipikar Balm AP+M', brand: 'La Roche-Posay', price: 1850, category: 'moisturizer' },
      { name: 'Atoderm Intensive Baume', brand: 'Bioderma', price: 1650, category: 'moisturizer' },
      { name: 'Cicaplast Baume B5+', brand: 'La Roche-Posay', price: 950, category: 'moisturizer' }
    );
  }

  // Избегать при беременности
  if (answers.pregnant) {
    recs.avoid.push('ретинол', 'салициловая кислота >2%', 'высокие дозы витамина С');
  }

  // Формируем шаги рутины
  recs.routineSteps.morning = ['cleanser', 'toner', 'serum', 'moisturizer', 'spf'];
  recs.routineSteps.evening = ['cleanser', 'toner', 'treatment', 'moisturizer'];
  
  if (highInflammation || damagedBarrier) {
    recs.routineSteps.evening.push('moisturizer'); // дополнительное увлажнение
  }

  return recs;
}

