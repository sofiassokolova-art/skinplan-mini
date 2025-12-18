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

// Структура ответов анкеты (адаптированная под текущую структуру)
export interface QuestionnaireAnswers {
  skinType?: string;
  age?: string;
  concerns?: string[];
  diagnoses?: string[];
  allergies?: string[];
  seasonChange?: string;
  habits?: string[];
  retinolReaction?: string;
  pregnant?: boolean;
  spfFrequency?: string;
  sunExposure?: string;
  [key: string]: any; // для дополнительных полей
}

/**
 * Рассчитывает 6 дерматологических осей кожи на основе ответов анкеты
 */
export function calculateSkinAxes(answers: QuestionnaireAnswers): SkinScore[] {
  const a = answers; // для краткости

  // 1. Oiliness (жирность)
  const oiliness = (() => {
    let score = 50; // нейтральная база
    if (a.skinType === 'oily') score += 40;
    if (a.skinType === 'combo' || a.skinType === 'combo_oily') score += 25;
    if (a.skinType === 'dry') score -= 30;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Жирность') || c.includes('блеск'))) score += 30;
    if (a.seasonChange === 'summer_oilier' || (typeof a.seasonChange === 'string' && a.seasonChange.includes('лето'))) score += 15;
    return Math.max(0, Math.min(100, score));
  })();

  // 2. Hydration + TEWL (трансэпидермальная потеря воды)
  const hydration = (() => {
    let score = 100; // идеальное увлажнение
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Сухость') || c.includes('стянутость'))) score -= 40;
    if (a.skinType === 'dry') score -= 35;
    if (a.seasonChange === 'winter_drier' || (typeof a.seasonChange === 'string' && a.seasonChange.includes('зима'))) score -= 20;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('не высыпаюсь') || h.includes('мало сплю'))) score -= 15;
    return Math.max(0, Math.min(100, score));
  })();

  // 3. Barrier Integrity (целостность барьера)
  const barrier = (() => {
    let score = 100; // здоровый барьер
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Чувствительность') || c.includes('чувствительна'))) score -= 30;
    if (Array.isArray(a.diagnoses) && a.diagnoses.some((d: string) => d.includes('Атопический') || d.includes('атопия'))) score -= 50;
    if (Array.isArray(a.allergies) && a.allergies.length > 0) score -= 25;
    if (a.retinolReaction === 'irritation' || (typeof a.retinolReaction === 'string' && a.retinolReaction.includes('раздражение'))) score -= 30;
    if (a.sensitivityLevel === 'high') score -= 30;
    return Math.max(0, Math.min(100, score));
  })();

  // 4. Inflammation / Acne (воспаление / акне)
  const inflammation = (() => {
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

  // 5. Pigmentation Risk (риск пигментации)
  const pigmentation = (() => {
    let score = 0;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Пигментация') || c.includes('пигментация'))) score += 50;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Неровный') || c.includes('тон'))) score += 30;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('солнце без SPF') || h.includes('без защиты'))) score += 40;
    if (Array.isArray(a.diagnoses) && a.diagnoses.some((d: string) => d.includes('Мелазма') || d.includes('мелазма'))) score = 90;
    if (a.pigmentationRisk === 'high') score += 40;
    return Math.min(100, score);
  })();

  // 6. Photoaging / Wrinkles (фотостарение / морщины)
  const photoaging = (() => {
    let score = 0;
    const age = a.age === '45+' || a.ageGroup === '45+' ? 90 : 
                a.age === '35-44' || a.ageGroup === '35-44' ? 70 : 
                a.age === '25-34' || a.ageGroup === '25-34' ? 40 : 10;
    score += age / 2;
    if (Array.isArray(a.concerns) && a.concerns.some((c: string) => c.includes('Морщины') || c.includes('морщины'))) score += 40;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('солнце без SPF') || h.includes('без защиты'))) score += 30;
    if (Array.isArray(a.habits) && a.habits.some((h: string) => h.includes('Курю') || h.includes('курю'))) score += 35;
    if (a.spfFrequency === 'never' || (typeof a.spfFrequency === 'string' && a.spfFrequency.includes('никогда'))) score += 25;
    return Math.min(100, score);
  })();

  return [
    { 
      axis: 'oiliness', 
      value: oiliness, 
      level: getLevel(oiliness, true), 
      title: 'Жирность', 
      description: desc.oiliness(oiliness), 
      color: '#10B981' 
    },
    { 
      axis: 'hydration', 
      value: 100 - hydration, // инвертируем: чем меньше увлажнение, тем больше обезвоженность
      level: getLevel(100 - hydration, false), 
      title: 'Обезвоженность', 
      description: desc.hydration(hydration), 
      color: '#3B82F6' 
    },
    { 
      axis: 'barrier', 
      value: barrier, 
      level: getLevel(100 - barrier, false), // инвертируем: чем меньше барьер, тем больше проблема
      title: 'Барьер', 
      description: desc.barrier(barrier), 
      color: '#F59E0B' 
    },
    { 
      axis: 'inflammation', 
      value: inflammation, 
      level: getLevel(inflammation, false), 
      title: 'Воспаление', 
      description: desc.inflammation(inflammation), 
      color: '#EF4444' 
    },
    { 
      axis: 'pigmentation', 
      value: pigmentation, 
      level: getLevel(pigmentation, false), 
      title: 'Пигментация', 
      description: desc.pigmentation(pigmentation), 
      color: '#8B5CF6' 
    },
    { 
      axis: 'photoaging', 
      value: photoaging, 
      level: getLevel(photoaging, false), 
      title: 'Фотостарение', 
      description: desc.photoaging(photoaging), 
      color: '#EC4899' 
    },
  ];
}

function getLevel(value: number, isPositive: boolean): 'low' | 'medium' | 'high' | 'critical' {
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

