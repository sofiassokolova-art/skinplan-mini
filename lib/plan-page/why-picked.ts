// lib/plan-page/why-picked.ts
// «Почему это средство в вашем плане» — короткое персональное обоснование для
// карточки продукта. Детерминированная сборка из того, что уже знаем: активы
// продукта × цели пользователя × тип кожи × чувствительность. Без БД и LLM.

import type { GoalKey } from '@/lib/concern-taxonomy';

export interface WhyPickedInput {
  activeIngredients: string[];
  category: string | null;
  /** stepCategory-слоты, которые продукт занимает в плане */
  stepCategories: string[];
  mainGoals: GoalKey[];
  skinType: string | null;
  sensitivityLevel: string | null;
}

const SKIN_TYPE_ACCUSATIVE: Record<string, string> = {
  dry: 'сухую кожу',
  oily: 'жирную кожу',
  normal: 'нормальную кожу',
  combination_dry: 'комбинированную кожу',
  combination_oily: 'комбинированную кожу',
  combo: 'комбинированную кожу',
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Возвращает 1–2 предложения «почему это средство у вас в плане», либо null,
 * если по данным продукта нечего сказать (UI тогда просто не показывает блок).
 */
export function buildWhyPicked(input: WhyPickedInput): string | null {
  const actives = (input.activeIngredients || []).map(normalize);
  const goals = new Set(input.mainGoals || []);
  const steps = input.stepCategories || [];
  const category = normalize(input.category || '');
  const sensitive = ['high', 'very_high'].includes(normalize(input.sensitivityLevel || ''));

  const has = (...keys: string[]): boolean =>
    actives.some((a) => keys.some((k) => a.includes(k)));
  const inStep = (prefix: string): boolean => steps.some((s) => s.startsWith(prefix));

  const skinTypeLabel = SKIN_TYPE_ACCUSATIVE[normalize(input.skinType || '')] ?? null;

  // ── 1. Причина по активу (самая ценная — почему ИМЕННО это средство) ──
  let activeReason: string | null = null;

  if (has('azelaic', 'азелаин')) {
    activeReason = goals.has('acne')
      ? 'азелаиновая кислота снижает воспаления и работает со следами постакне'
      : 'азелаиновая кислота мягко выравнивает тон и снимает покраснения';
  } else if (has('adapalene', 'адапален', 'tretinoin', 'ретиналь', 'retinal', 'retinol', 'ретинол')) {
    activeReason = goals.has('acne')
      ? 'ретиноид нормализует обновление кожи и работает с высыпаниями'
      : 'ретиноид — самый изученный актив против морщин и потери упругости';
  } else if (has('bakuchiol', 'бакучиол')) {
    activeReason = 'бакучиол — мягкая альтернатива ретинолу: работает с признаками возраста без раздражения';
  } else if (has('vitamin_c', 'ascorb', 'витамин c', 'витамин с')) {
    activeReason = 'витамин C осветляет пигментацию и придаёт коже сияние';
  } else if (has('niacinamide', 'ниацинамид')) {
    if (goals.has('pores') || goals.has('acne')) {
      activeReason = 'ниацинамид регулирует себум и делает поры менее заметными';
    } else if (goals.has('pigmentation')) {
      activeReason = 'ниацинамид выравнивает тон и осветляет пятна';
    } else {
      activeReason = 'ниацинамид укрепляет защитный барьер и успокаивает кожу';
    }
  } else if (has('salicylic', 'салицил', 'bha', 'lha')) {
    activeReason = 'салициловая кислота очищает поры изнутри и предотвращает высыпания';
  } else if (has('glycolic', 'lactic', 'mandelic', 'миндальн', 'молочн', 'гликолев', 'aha')) {
    activeReason = 'мягкие кислоты обновляют текстуру и выравнивают рельеф кожи';
  } else if (has('ceramide', 'церамид', 'panthenol', 'пантенол', 'centella', 'центелл', 'cica', 'madecass')) {
    activeReason = sensitive
      ? 'церамиды и успокаивающие компоненты восстанавливают барьер — это база при чувствительной коже'
      : 'церамиды и успокаивающие компоненты укрепляют защитный барьер кожи';
  } else if (has('hyaluron', 'гиалурон', 'glycerin', 'глицерин', 'squalane', 'сквалан')) {
    activeReason = goals.has('dehydration')
      ? 'увлажняющие компоненты удерживают влагу — именно то, что нужно обезвоженной коже'
      : 'увлажняющие компоненты удерживают влагу и поддерживают комфорт кожи';
  } else if (has('peptide', 'пептид')) {
    activeReason = 'пептиды стимулируют упругость и плотность кожи';
  }

  // ── 2. SPF — отдельный случай: причина в роли шага, а не в активе ──
  const isSpf = category === 'spf' || inStep('spf') || has('spf');
  if (isSpf) {
    return goals.has('pigmentation')
      ? 'Ежедневный SPF — обязательный шаг при работе с пигментацией: без него новые пятна появляются быстрее, чем сходят старые.'
      : 'Ежедневный SPF защищает результат всего ухода: UV — главная причина фотостарения и пигментации.';
  }

  // ── 3. Персональный хвост ──
  const tail = sensitive
    ? 'Выбрано с учётом вашей чувствительной кожи.'
    : null;

  if (activeReason) {
    const lead = skinTypeLabel
      ? `Под вашу ${skinTypeLabel.replace(' кожу', '')} кожу: ${activeReason}.`
      : `${activeReason[0].toUpperCase()}${activeReason.slice(1)}.`;
    return tail ? `${lead} ${tail}` : lead;
  }

  // ── 4. Фолбэк по роли шага (актив не распознан) ──
  if (inStep('cleanser') || category === 'cleanser') {
    const base = skinTypeLabel
      ? `Мягкое очищение под вашу ${skinTypeLabel}: очищает, не нарушая защитный барьер`
      : 'Мягкое очищение: очищает, не нарушая защитный барьер';
    return tail ? `${base}. ${tail}` : `${base}.`;
  }
  if (inStep('moisturizer') || category === 'moisturizer' || category === 'cream') {
    if (inStep('moisturizer_barrier') || inStep('moisturizer_soothing') || sensitive) {
      return 'Восстанавливает защитный барьер — при чувствительной или обезвоженной коже это основа ухода.';
    }
    return skinTypeLabel
      ? `Увлажнение подобрано под вашу ${skinTypeLabel}: поддерживает баланс без перегруза.`
      : 'Поддерживает увлажнение и баланс кожи без перегруза.';
  }
  if (inStep('toner') || category === 'toner') {
    return 'Тоник возвращает коже комфорт после очищения и готовит её к следующим шагам.';
  }
  if (inStep('lip_care') || category === 'lip_care') {
    return 'Кожа губ тоньше и без сальных желёз — ей нужен отдельный уход.';
  }

  return null;
}
