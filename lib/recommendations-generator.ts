// lib/recommendations-generator.ts
// ИСПРАВЛЕНО: Вынесенная логика генерации RecommendationSession
// Используется в /api/recommendations/build для идемпотентной генерации рекомендаций

import { prisma } from '@/lib/db';
import { logger } from './logger';
import { calculateSkinAxes, getDermatologistRecommendations } from './skin-analysis-engine';
import { buildRuleContext, type RuleContext } from './rule-context';
import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from './skin-type-normalizer';
import { getProductsForStep } from './product-selection';
import { deriveFocusKeys, FOCUS_TO_GOAL } from './focus-keys';
import type { ProfileClassification } from './plan-generation-helpers';

export interface RecommendationGenerationResult {
  sessionId: string;
  ruleId: number | null;
  products: number[];
}

export interface RecommendationGenerationError {
  ok: false;
  reason: 'profile_not_found' | 'no_active_questionnaire' | 'no_matching_rule' | 'invalid_steps_json' | 'no_products_found' | 'unknown_error';
}

/**
 * ИСПРАВЛЕНО: Полная поддержка операторов условий для правил рекомендаций
 * Поддерживает: gte, lte, equals, not/neq, in, hasSome, hasEvery, contains, startsWith
 */
export function matchCondition(condition: any, profileValue: any): boolean {
  // Если profileValue null/undefined и условие требует значение - не матчится
  if (profileValue === undefined || profileValue === null) {
    // Для числовых сравнений (gte/lte) null = не матчится
    if (typeof condition === 'object' && condition !== null && ('gte' in condition || 'lte' in condition || 'gt' in condition || 'lt' in condition)) {
      return false;
    }
    // Для equals/not null = не матчится (если явно не указано null)
    if (typeof condition === 'object' && condition !== null && ('equals' in condition || 'not' in condition || 'neq' in condition)) {
      return condition.equals === null || condition.not === null || condition.neq === null;
    }
    // Любой «позитивный» оператор (in/hasSome/hasEvery/contains/startsWith и
    // массив-in) требует наличия значения: отсутствующее (null) поле его НЕ
    // удовлетворяет. Иначе, например, правило {concerns: {hasSome:['rosacea']}}
    // матчило бы пользователя с concerns=null. Совпадение «по отсутствию»
    // обрабатывается выше (equals/not/neq === null).
    return false;
  }

  // Массив условий = in (любое из значений)
  if (Array.isArray(condition)) {
    return condition.includes(profileValue);
  }

  // Объект условий = операторы
  if (typeof condition === 'object' && condition !== null) {
    // Числовые сравнения. ВАЖНО: операторы границ комбинируются в одном объекте
    // ({ gte: 30, lte: 65 } = диапазон 30..65). Раньше каждая ветка делала return
    // сразу — и при наличии gte верхняя граница lte молча игнорировалась
    // (правило ловило значения выше lte). Проверяем ВСЕ присутствующие границы
    // через AND и возвращаемся, только когда все они учтены.
    const hasNumericBound =
      'gte' in condition || 'lte' in condition || 'gt' in condition || 'lt' in condition;
    if (hasNumericBound) {
      const numValue = typeof profileValue === 'number' ? profileValue : parseFloat(profileValue);
      if (isNaN(numValue)) return false;
      const toNum = (v: any) => (typeof v === 'number' ? v : parseFloat(v));
      if ('gte' in condition) {
        const c = toNum(condition.gte);
        if (isNaN(c) || numValue < c) return false;
      }
      if ('lte' in condition) {
        const c = toNum(condition.lte);
        if (isNaN(c) || numValue > c) return false;
      }
      if ('gt' in condition) {
        const c = toNum(condition.gt);
        if (isNaN(c) || numValue <= c) return false;
      }
      if ('lt' in condition) {
        const c = toNum(condition.lt);
        if (isNaN(c) || numValue >= c) return false;
      }
      return true;
    }

    // Равенство
    if ('equals' in condition) {
      return profileValue === condition.equals;
    }

    // Неравенство
    if ('not' in condition || 'neq' in condition) {
      const notValue = condition.not !== undefined ? condition.not : condition.neq;
      return profileValue !== notValue;
    }

    // in (массив значений)
    if ('in' in condition && Array.isArray(condition.in)) {
      return condition.in.includes(profileValue);
    }

    // hasSome (хотя бы один элемент массива совпадает)
    if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
      const profileArray = Array.isArray(profileValue) ? profileValue : [profileValue];
      return condition.hasSome.some((item: any) => profileArray.includes(item));
    }

    // hasEvery (все элементы массива присутствуют)
    if ('hasEvery' in condition && Array.isArray(condition.hasEvery)) {
      const profileArray = Array.isArray(profileValue) ? profileValue : [profileValue];
      return condition.hasEvery.every((item: any) => profileArray.includes(item));
    }

    // contains (строка содержит подстроку)
    if ('contains' in condition) {
      const strValue = String(profileValue).toLowerCase();
      const strCondition = String(condition.contains).toLowerCase();
      return strValue.includes(strCondition);
    }

    // startsWith (строка начинается с подстроки)
    if ('startsWith' in condition) {
      const strValue = String(profileValue).toLowerCase();
      const strCondition = String(condition.startsWith).toLowerCase();
      return strValue.startsWith(strCondition);
    }
  }

  // Простое сравнение (примитив)
  return condition === profileValue;
}

// Лейблы concern-опций анкеты → доменные токены, которыми оперируют правила
// (conditions { concerns: { hasSome: [...] } }). В answerValues лежат автокоды
// ("skin_concerns_5"), а ruleContext.concerns строится из ЛЕЙБЛОВ — поэтому без
// этого маппинга правила на concerns (напр. postacne-scars) молча не матчились.
// Substring-матчинг; ВАЖЕН порядок: 'постакне'/'следы' раньше 'акне', иначе
// "следы от акне (постакне)" уедет в acne.
const CONCERN_LABEL_PATTERNS: Array<[RegExp, string]> = [
  [/постакне|следы от акне|рубц/i, 'postacne_scars'],
  [/акне|высыпан/i, 'acne'],
  [/пигмент|неровный тон|мелазма/i, 'pigmentation'],
  [/морщин|возрастн|старени/i, 'wrinkles'],
  [/сухость|стянут|обезвож/i, 'dehydration'],
  [/жирность|блеск|поры/i, 'pores'],
  [/чувствительн|покраснени/i, 'sensitivity'],
];

export function concernLabelsToRuleTokens(labels: string[] | undefined | null): string[] {
  if (!Array.isArray(labels)) return [];
  const tokens = new Set<string>();
  for (const label of labels) {
    if (typeof label !== 'string') continue;
    for (const [re, token] of CONCERN_LABEL_PATTERNS) {
      if (re.test(label)) {
        tokens.add(token);
        break; // один лейбл = один токен (первый совпавший паттерн)
      }
    }
  }
  return Array.from(tokens);
}

const TREATMENT_SIGNAL_TO_PRODUCT_CONCERNS: Record<string, string[]> = {
  acne: ['acne'],
  blackheads: ['acne'],
  pores: ['oiliness', 'pores'],
  oiliness: ['oiliness', 'pores'],
  pigmentation: ['pigmentation'],
  postacne_scars: ['postacne_scars'],
  // В правилах/осях antiage часто приходит как photoaging, а каталог anti-age
  // активов исторически размечен через wrinkles. Держим оба словаря валидными.
  antiage: ['wrinkles', 'photoaging', 'antiage'],
  wrinkles: ['wrinkles', 'photoaging', 'antiage'],
  texture: ['texture'],
  dullness: ['dullness'],
};

export function treatmentSignalsToProductConcerns(signals: string[]): string[] {
  const concerns = new Set<string>();
  for (const signal of signals) {
    for (const concern of TREATMENT_SIGNAL_TO_PRODUCT_CONCERNS[signal] || []) {
      concerns.add(concern);
    }
  }
  return Array.from(concerns);
}

const YOUNG_PREVENTION_AGES = new Set(['under_25', '25-34']);

function hasToken(values: unknown, tokens: string[]): boolean {
  const arr = Array.isArray(values) ? values : [];
  return arr.some((value) => tokens.includes(String(value)));
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isAge35Plus(age: unknown): boolean {
  return ['35-44', '45-54', '55+'].includes(String(age || ''));
}

/**
 * Клинический гейт для автодобавления treatment-шагов.
 *
 * Goals сами по себе часто означают профилактический запрос ("хочу меньше поры",
 * "antiage заранее"). Для лечебного актива нужны более явные показания:
 * acneLevel/воспаление, риск пигментации, высокий photoaging или concern, а не
 * только желание пользователя. Иначе молодая жирная кожа с профилактической целью
 * получала ретиноид/BHA/BPO поверх мягкой рутины.
 */
export function deriveTreatmentSignalsForRuleContext(ruleContext: Partial<RuleContext>): string[] {
  const signals: string[] = [];
  const push = (token: string) => {
    if (!signals.includes(token)) signals.push(token);
  };

  const concerns = ruleContext.concerns || [];
  const goals = ruleContext.goals || [];
  const diagnoses = ruleContext.diagnoses || [];
  const age = ruleContext.age;
  const sensitivity = String(ruleContext.sensitivity_level || ruleContext.sensitivityLevel || '');
  const rosaceaRisk = String(ruleContext.rosaceaRisk || '');
  const isReactiveSkin =
    ['high', 'very_high'].includes(sensitivity) ||
    ['medium', 'high', 'critical'].includes(rosaceaRisk) ||
    hasToken(diagnoses, ['rosacea', 'atopic_dermatitis']);

  const hasAcneSignal =
    hasToken(concerns, ['acne', 'blackheads']) ||
    hasToken(diagnoses, ['acne']) ||
    numberValue(ruleContext.acneLevel) > 0 ||
    numberValue(ruleContext.inflammation) >= 60;
  if (hasAcneSignal) push('acne');

  const hasPigmentationSignal =
    hasToken(concerns, ['pigmentation', 'postacne_scars']) ||
    hasToken(diagnoses, ['melasma']) ||
    ['medium', 'high'].includes(String(ruleContext.pigmentationRisk || '')) ||
    numberValue(ruleContext.pigmentation) >= 50;
  if (hasPigmentationSignal) {
    push(hasToken(concerns, ['postacne_scars']) ? 'postacne_scars' : 'pigmentation');
  }

  const hasPoreIndication = hasToken(concerns, ['pores', 'oiliness', 'blackheads']);
  if (hasPoreIndication && !isReactiveSkin) push('pores');

  const hasAntiageConcern = hasToken(concerns, ['wrinkles', 'antiage']);
  const hasObjectivePhotoaging = numberValue(ruleContext.photoaging) >= 60;
  const hasAntiageIndication =
    hasAntiageConcern ||
    hasObjectivePhotoaging ||
    (hasToken(goals, ['antiage']) && (isAge35Plus(age) || numberValue(ruleContext.photoaging) >= 40));
  const isYoungAge = YOUNG_PREVENTION_AGES.has(String(age || ''));
  if (hasAntiageIndication && (!isYoungAge || hasObjectivePhotoaging)) push('antiage');
  if (hasAntiageConcern && isYoungAge) push('wrinkles');

  if (hasToken(concerns, ['texture'])) push('texture');
  if (hasToken(concerns, ['dullness'])) push('dullness');

  return signals;
}

export function deriveTreatmentConcernsForRuleContext(ruleContext: Partial<RuleContext>): string[] {
  return treatmentSignalsToProductConcerns(deriveTreatmentSignalsForRuleContext(ruleContext));
}

/**
 * Генерирует RecommendationSession для профиля
 * ИСПРАВЛЕНО: Идемпотентная функция - можно вызывать несколько раз
 */
export async function generateRecommendationsForProfile(
  userId: string,
  profileId: string
): Promise<RecommendationGenerationResult | RecommendationGenerationError> {
  try {
    // Профиль, активная анкета и правила рекомендаций независимы друг от друга —
    // читаем параллельно (на happy-path экономим 2 последовательных round-trip).
    const [profile, activeQuestionnaire, rules] = await Promise.all([
      prisma.skinProfile.findUnique({
        where: { id: profileId },
        include: { user: { select: { id: true } } },
      }),
      prisma.questionnaire.findFirst({
        where: { isActive: true },
        select: { id: true },
      }),
      prisma.recommendationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      }),
    ]);

    if (!profile || profile.userId !== userId) {
      logger.error('Profile not found or does not belong to user', { userId, profileId });
      return { ok: false, reason: 'profile_not_found' };
    }

    // Используем активную анкету как source of truth для answers/scores
    // ИСПРАВЛЕНО: ранее ошибочно использовали profile.version как questionnaireId
    const questionnaireId = activeQuestionnaire?.id ?? null;
    if (!questionnaireId) {
      logger.error('No active questionnaire found for recommendations generation', { userId, profileId });
      return { ok: false, reason: 'no_active_questionnaire' };
    }

    // Получаем ответы пользователя для расчета axes
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId, // ИСПРАВЛЕНО: активная анкета
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    // Строим questionnaireAnswers для расчета axes
    // ВАЖНО: оси (oiliness/pigmentation/photoaging/…) матчат concerns/habits по русским
    // ЛЕЙБЛАМ ("Морщины", "Жирность"), а в answerValues лежат коды опций
    // ("skin_concerns_5"). Резолвим коды→лейблы через answerOptions, иначе все
    // concern-бонусы осей терялись и оси были «слепы» к беспокойствам.
    const labelsOf = (answer: any): string[] => {
      const opts = answer.question?.answerOptions ?? [];
      const map = new Map<string, string>(opts.map((o: any) => [o.value, o.label]));
      const vals = Array.isArray(answer.answerValues) ? answer.answerValues : [];
      return vals.map((v: string) => map.get(v) ?? v);
    };
    const labelOfSingle = (answer: any): string | null => {
      if (!answer.answerValue) return null;
      const opts = answer.question?.answerOptions ?? [];
      const option = opts.find((o: any) => o.value === answer.answerValue);
      return option?.label ?? answer.answerValue;
    };
    const normalizeSensitivityAnswer = (raw: string | null): string => {
      const value = String(raw || '').toLowerCase();
      if (value.includes('сильн') || value.includes('стойк') || value.includes('high') || value.endsWith('_4')) return 'high';
      if (value.includes('заметн') || value.includes('средн') || value.includes('medium') || value.endsWith('_3')) return 'medium';
      return 'low';
    };
    const questionnaireAnswers: any = {};
    for (const answer of userAnswers) {
      const code = answer.question?.code;
      if (!code) continue;

      const value = answer.answerValue ||
        (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);

      if (code === 'skin_type' || code === 'skinType') {
        questionnaireAnswers.skinType = value;
      } else if (code === 'age' || code === 'age_group') {
        questionnaireAnswers.age = value;
      } else if (code === 'concerns' || code === 'skin_concerns') {
        questionnaireAnswers.concerns = labelsOf(answer);
      } else if (code === 'skin_goals' || code === 'goals') {
        // Цели пользователя (морщины/поры/…) — отдельный сигнал от concerns.
        questionnaireAnswers.goals = labelsOf(answer);
      } else if (code === 'habits') {
        questionnaireAnswers.habits = labelsOf(answer);
      } else if (code === 'diagnoses' || code === 'medical_diagnoses') {
        questionnaireAnswers.diagnoses = labelsOf(answer);
      } else if (code === 'skin_sensitivity' || code === 'sensitivity_level' || code === 'sensitivityLevel') {
        questionnaireAnswers.sensitivityLevel = normalizeSensitivityAnswer(labelOfSingle(answer) || (typeof value === 'string' ? value : null) || 'low');
      } else if (code === 'acne_level' || code === 'acneLevel') {
        questionnaireAnswers.acneLevel = typeof value === 'number' ? value : (parseInt(value as string) || 0);
      }
    }

    // Вычисляем skin scores
    const skinScores = calculateSkinAxes(questionnaireAnswers);

    // Нормализуем тип кожи и чувствительность
    const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, { userId });
    const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);

    // Строим RuleContext.
    // ВАЖНО: правилам отдаём concerns в виде доменных ТОКЕНОВ (postacne_scars/acne/…),
    // а не русских лейблов — иначе concerns-условия не матчатся (см.
    // concernLabelsToRuleTokens). Лейблы при этом остаются в questionnaireAnswers
    // для скоринга осей (calculateSkinAxes выше).
    const concernTokens = concernLabelsToRuleTokens(questionnaireAnswers.concerns);
    // Цели → GoalKey-токены через те же терпимые матчеры лейблов, что и в плане
    // (deriveFocusKeys + FOCUS_TO_GOAL). Даёт правилам сигнал antiage/pores/… из
    // skin_goals, которого движок раньше не видел.
    const goalTokens = Array.from(
      new Set(
        Array.from(deriveFocusKeys(Array.isArray(questionnaireAnswers.goals) ? questionnaireAnswers.goals : []))
          .map((focus) => FOCUS_TO_GOAL[focus])
          .filter((g): g is NonNullable<typeof g> => Boolean(g))
      )
    );
    const ruleContext = buildRuleContext(profile as any, skinScores, normalizedSkinType, normalizedSensitivity, concernTokens, goalTokens);

    // Ищем подходящее правило (rules уже загружены параллельно выше).

    // ИСПРАВЛЕНО: Полная поддержка операторов условий (gte/lte/equals/not/hasEvery/in/contains)
    let matchedRule: any = null;
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      
      let matches = true;
      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = (ruleContext as any)[key];
        
        // ИСПРАВЛЕНО: Проверяем условие с поддержкой всех операторов
        if (!matchCondition(condition, profileValue)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      logger.warn('No matching rule found', { userId, profileId });
      return { ok: false, reason: 'no_matching_rule' };
    }

    // Получаем продукты для каждого шага правила
    const stepsJson = matchedRule.stepsJson as any;
    const allProductIds: number[] = [];

    // budgetSegment: профильной колонки нет, поэтому читаем из medicalMarkers.budget
    // (кладётся в /api/questionnaire/answers из вопроса `budget`). Тот же источник, что
    // и RuleContext.budget — бюджет влияет и на ценовой сегмент подбора, и на матчинг.
    const budgetSegment =
      (profile as any).budgetSegment ||
      ((profile as any).medicalMarkers?.budget as string | undefined) ||
      null;
    const budgetMappings: Record<string, { label: 'бюджетный' | 'средний' | 'премиум' | 'любой'; priceSegment?: 'mass' | 'mid' | 'premium' }> = {
      budget: { label: 'бюджетный', priceSegment: 'mass' },
      budget_1: { label: 'бюджетный', priceSegment: 'mass' },
      low: { label: 'бюджетный', priceSegment: 'mass' },
      medium: { label: 'средний', priceSegment: 'mid' },
      budget_2: { label: 'средний', priceSegment: 'mid' },
      premium: { label: 'премиум', priceSegment: 'premium' },
      budget_3: { label: 'премиум', priceSegment: 'premium' },
      any: { label: 'любой' },
      budget_4: { label: 'любой' },
      'бюджетный': { label: 'бюджетный', priceSegment: 'mass' },
      'средний': { label: 'средний', priceSegment: 'mid' },
      'премиум': { label: 'премиум', priceSegment: 'premium' },
      'любой': { label: 'любой' },
    };
    const normalizedBudget = budgetSegment ? budgetMappings[budgetSegment] : undefined;

    // ИСПРАВЛЕНО: Строим ProfileClassification для unified-product-filter
    const profileClassification: ProfileClassification = {
      skinType: profile.skinType || 'normal',
      concerns: (profile as any).concerns || [],
      diagnoses: (profile as any).diagnoses || [],
      rosaceaRisk: (profile as any).rosaceaRisk ?? null,
      pregnant: profile.hasPregnancy || false,
      mainGoals: (profile as any).mainGoals || [],
      secondaryGoals: (profile as any).secondaryGoals || [],
      sensitivityLevel: profile.sensitivityLevel || 'low',
      budget: normalizedBudget?.label || 'средний',
      exclude: (profile as any).exclude || [],
      allergies: (profile as any).allergies || [],
      ageGroup: profile.ageGroup || null,
    };

    // ИСПРАВЛЕНО: stepsJson в БД обычно объект { stepName: RuleStep }, но поддерживаем и массив для обратной совместимости
    if (Array.isArray(stepsJson)) {
      for (const step of stepsJson) {
        const products = await getProductsForStep(step, normalizedBudget?.priceSegment, profileClassification);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else if (stepsJson && typeof stepsJson === 'object') {
      for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
        const cfg = (stepConfig || {}) as any;
        // Выбор продуктов идёт по step.category. Если правило задало шаг без category
        // (как serum-шаг в правиле «Лето»), берём имя шага как категорию — иначе шаг
        // не привязан к категории и нужный продукт (напр. сыворотка) терялся.
        const resolved =
          Array.isArray(cfg.category) && cfg.category.length > 0
            ? cfg
            : { ...cfg, category: [stepName] };
        const products = await getProductsForStep(resolved, normalizedBudget?.priceSegment, profileClassification);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else {
      logger.warn('Matched rule has invalid stepsJson, cannot select products', {
        userId,
        profileId,
        ruleId: matchedRule.id,
        stepsJsonType: typeof stepsJson,
      });
      return { ok: false, reason: 'invalid_steps_json' } as any;
    }

    // Дополняем сессию обязательными шагами, если правило их не задало (serum, treatment, mask).
    // Один централизованный фикс — все сессии получают полный набор без правки десятков правил.
    const requiredStepGroups = ['serum', 'treatment', 'mask'] as const;
    const ruleStepKeys = Array.isArray(stepsJson)
      ? (stepsJson as { category?: string[] }[])
          .filter((s) => s?.category)
          .flatMap((s) => s.category!.map((c) => c.toLowerCase()))
      : Object.keys(stepsJson || {}).map((k) => k.toLowerCase());
    const hasStep = (step: string) =>
      ruleStepKeys.includes(step) || ruleStepKeys.some((k) => k.startsWith(step + '_'));

    // Показания к treatment-шагу. Лечебный актив навязываем только при акне/жирности-
    // порах/пигментации/постакне/антиэйдже. Иначе не добавляем «лечение» (раньше шаг
    // добавлялся всем, и юзер без показаний получал, напр., азелаин от акне).
    // signal-токены (concerns+goals+уровни) маппим в вокабуляр concerns у продуктов,
    // чтобы подбор взял релевантный treatment, а не первый по приоритету.
    const treatmentConcerns = deriveTreatmentConcernsForRuleContext(ruleContext);
    const treatmentIndicated = treatmentConcerns.length > 0;

    for (const stepGroup of requiredStepGroups) {
      if (hasStep(stepGroup)) continue;
      // Гейт: treatment добавляем только при показаниях и направляем подбор по ним.
      if (stepGroup === 'treatment' && !treatmentIndicated) {
        logger.info('Treatment step skipped: no indication', { userId, profileId, ruleId: matchedRule.id });
        continue;
      }
      const stepSpec =
        stepGroup === 'treatment'
          ? { category: ['treatment'], concerns: treatmentConcerns, max_items: 1 }
          : { category: [stepGroup], max_items: 1 };
      const fallbackProducts = await getProductsForStep(
        stepSpec,
        normalizedBudget?.priceSegment,
        profileClassification
      );
      if (fallbackProducts.length === 0) continue;
      let chosen = fallbackProducts[0] as any;

      // Для treatment добавляем ТОЛЬКО реально релевантный продукт: его concerns
      // должны пересекаться с показаниями. Иначе на antiage-показание подбор
      // отдавал бы acne-hero (Baziron) — навязанное «лечение акне». Нет релевантного
      // — лучше не добавлять treatment совсем (serum/рутина закрывают профилактику).
      if (stepGroup === 'treatment') {
        const relevantProduct = fallbackProducts.find((product: any) => {
          const productConcerns = Array.isArray(product?.concerns)
            ? product.concerns.map((c: string) => String(c).toLowerCase())
            : [];
          return treatmentConcerns.some((c) => productConcerns.includes(c));
        });
        if (!relevantProduct) {
          logger.info('Treatment step skipped: no concern-relevant product', {
            userId, profileId, ruleId: matchedRule.id, candidate: chosen?.id, treatmentConcerns,
          });
          continue;
        }
        chosen = relevantProduct as any;
      }

      allProductIds.push(chosen.id);
      logger.info('Session supplemented with required step', {
        step: stepGroup,
        productId: chosen.id,
        productName: chosen.name,
        userId,
        profileId,
        ruleId: matchedRule.id,
      });
    }

    // ИСПРАВЛЕНО: Убираем дубли продуктов и стабилизируем порядок
    const uniqueProductIds = Array.from(new Set(allProductIds));
    // Стабилизируем сортировку по ID для предсказуемости
    const sortedProductIds = uniqueProductIds.sort((a, b) => a - b);

    // ИСПРАВЛЕНО: Создаем или обновляем RecommendationSession
    // ВАЖНО: Для избежания гонок рекомендуется добавить @@unique([userId, profileId]) в схему Prisma
    // и использовать upsert с userId_profileId. Пока используем findFirst + create/update
    const existingSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id,
      },
    });

    const session = existingSession
      ? await prisma.recommendationSession.update({
          where: { id: existingSession.id },
          data: {
            ruleId: matchedRule.id,
            products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
          },
        })
      : await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
          },
        });

    // ИСПРАВЛЕНО: Проверяем, что есть продукты
    if (sortedProductIds.length === 0) {
      logger.warn('No products found for matched rule', { userId, profileId, ruleId: matchedRule.id });
      return { ok: false, reason: 'no_products_found' };
    }

    return {
      sessionId: String(session.id), // ИСПРАВЛЕНО: Приводим к строке
      ruleId: matchedRule.id,
      products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
    };

  } catch (error) {
    logger.error('Error generating recommendations', { userId, profileId, error });
    return { ok: false, reason: 'unknown_error' };
  }
}
