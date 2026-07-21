// tests/acid-frequency-tiers.test.ts
// Частотные тиры кислот. Прод-аудит 15 планов выявил 3 превышения:
//   cmqtbaxhu… — Glycolic 7% (id 641) все 28 дней (7/7/7/7)
//   cmrp6kr01… — Glycolic 7% (0/7/7/0)
//   cmrngwr8q… — Mizon AHA&BHA (id 674) (0/7/7/0)
// Норма держалась только в weekly-блоке: cmr2idtmr… — BHA Blackhead Liquid (1/2/2/2).
//
// Корень: isActiveStepAllowedOnDay выводила активы из СЛОТА. Кислота в toner_soothing →
// у слота активов нет → кап не применялся. Плюс у glycolic_acid/lactic_acid/pha не было
// расписания вовсе (протоколы знают только «зонтики» aha/bha) → frequency: null.

import { describe, it, expect } from 'vitest';
import {
  isActiveStepAllowedOnDay,
  shouldRouteAcidToWeekly,
  formatWeeklyFrequencyLabel,
  getScheduledFrequencyForStep,
} from '@/lib/plan-generator';
import {
  getEffectiveIngredientSchedule,
  getMaxWeeklyFrequency,
  DERMATOLOGY_PROTOCOLS,
} from '@/lib/dermatology-protocols';
import { extractActiveIngredients } from '@/lib/ingredient-compatibility';
import type { StepCategory } from '@/lib/step-category-rules';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';

const normal = DERMATOLOGY_PROTOCOLS.normal;
const acne = DERMATOLOGY_PROTOCOLS.acne;

const normalSkin: ProfileClassification = { skinType: 'oily', sensitivityLevel: 'low' };
const sensitiveSkin: ProfileClassification = { skinType: 'dry', sensitivityLevel: 'high' };

function product(activeIngredients: string[], step = 'toner', category: string | null = 'toner') {
  return { activeIngredients, step, category };
}

/** Сколько дней в неделю продукт реально попадает в план (схема прод-аудита: 7/7/7/7). */
function daysPerWeek(
  p: ReturnType<typeof product>,
  stepCategory: StepCategory,
  protocol = normal,
  profile = normalSkin
): number[] {
  return [1, 2, 3, 4].map((week) => {
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const dayIndex = (week - 1) * 7 + d + 1;
      if (isActiveStepAllowedOnDay(stepCategory, dayIndex, week, protocol, profile, p)) count++;
    }
    return count;
  });
}

describe('источник активов — продукт, а не слот', () => {
  it('гликолевая кислота в нейтральном слоте toner_soothing больше не ежедневная', () => {
    // Прод-кейс cmqtbaxhu…: было 7/7/7/7.
    const counts = daysPerWeek(product(['glycolic_acid']), 'toner_soothing');
    expect(counts).toEqual([2, 2, 3, 3]);
  });

  it('без продукта поведение слотовое (обратная совместимость)', () => {
    // toner_soothing сам по себе активов не несёт → ограничений нет.
    let count = 0;
    for (let d = 1; d <= 7; d++) {
      if (isActiveStepAllowedOnDay('toner_soothing', d, 1, normal, normalSkin)) count++;
    }
    expect(count).toBe(7);
  });

  it('маркетинговое название не читается: «Acid Mantle Repair Cream» без кислот в составе не капается', () => {
    const cream = product(['ceramides', 'panthenol'], 'moisturizer', 'moisturizer');
    expect(daysPerWeek(cream, 'moisturizer_barrier')).toEqual([7, 7, 7, 7]);
  });

  it('пустой activeIngredients → падаем на слот и капаем (безопасное направление)', () => {
    const unknown = product([], 'treatment', 'treatment');
    const counts = daysPerWeek(unknown, 'treatment_exfoliant_mild');
    counts.forEach((c) => expect(c).toBeLessThan(7));
  });
});

describe('тиры конкретных кислот (не плоский кап)', () => {
  it('гликолевая — старт 2/нед с рампом вверх', () => {
    expect(daysPerWeek(product(['glycolic_acid']), 'toner_soothing')).toEqual([2, 2, 3, 3]);
  });

  it('молочная переносится лучше гликолевой — потолок выше', () => {
    const lactic = daysPerWeek(product(['lactic_acid']), 'toner_soothing');
    const glycolic = daysPerWeek(product(['glycolic_acid']), 'toner_soothing');
    expect(lactic).toEqual([3, 3, 4, 4]);
    lactic.forEach((c, i) => expect(c).toBeGreaterThanOrEqual(glycolic[i]));
  });

  it('миндальная — самая мягкая AHA, потолок ещё выше', () => {
    const mandelic = daysPerWeek(product(['mandelic acid']), 'toner_soothing');
    const lactic = daysPerWeek(product(['lactic_acid']), 'toner_soothing');
    mandelic.forEach((c, i) => expect(c).toBeGreaterThanOrEqual(lactic[i]));
  });

  it('PHA (глюконолактон) допустим ежедневно — не зарезан до 2/нед', () => {
    expect(daysPerWeek(product(['gluconolactone']), 'toner_soothing')).toEqual([7, 7, 7, 7]);
  });

  it('PHA остаётся ежедневным даже при чувствительной коже', () => {
    expect(daysPerWeek(product(['pha']), 'toner_soothing', normal, sensitiveSkin))
      .toEqual([7, 7, 7, 7]);
  });

  it('низкий-% BHA leave-on вне акне-протокола допустим ежедневно', () => {
    expect(daysPerWeek(product(['salicylic_acid']), 'toner_soothing')).toEqual([7, 7, 7, 7]);
  });
});

describe('чувствительная кожа — более строгий тир', () => {
  it('гликолевая при high sensitivity строже, чем при low', () => {
    const strict = daysPerWeek(product(['glycolic_acid']), 'toner_soothing', normal, sensitiveSkin);
    const normalTier = daysPerWeek(product(['glycolic_acid']), 'toner_soothing', normal, normalSkin);
    expect(strict).toEqual([1, 1, 2, 2]);
    strict.forEach((c, i) => expect(c).toBeLessThanOrEqual(normalTier[i]));
  });

  it('very_high трактуется как high (прецедент findFallbackProduct)', () => {
    const veryHigh: ProfileClassification = { sensitivityLevel: 'very_high' };
    expect(daysPerWeek(product(['glycolic_acid']), 'toner_soothing', normal, veryHigh))
      .toEqual([1, 1, 2, 2]);
  });
});

describe('scope только leave-on', () => {
  it('кислотная УМЫВАЛКА не капается — используется ежедневно', () => {
    const acidCleanser = product(['salicylic_acid', 'glycolic_acid'], 'cleanser', 'cleanser');
    expect(daysPerWeek(acidCleanser, 'cleanser_deep')).toEqual([7, 7, 7, 7]);
    expect(daysPerWeek(acidCleanser, 'cleanser_gentle')).toEqual([7, 7, 7, 7]);
  });

  it('та же кислота в leave-on тонере — капается', () => {
    const counts = daysPerWeek(product(['glycolic_acid']), 'toner_soothing');
    counts.forEach((c) => expect(c).toBeLessThan(7));
  });

  it('кап действует на toner/serum/treatment/mask', () => {
    const slots: StepCategory[] = [
      'toner_soothing', 'serum_hydrating', 'treatment_exfoliant_mild', 'mask_acid',
    ];
    for (const slot of slots) {
      daysPerWeek(product(['glycolic_acid']), slot).forEach((c) => expect(c).toBeLessThan(7));
    }
  });
});

describe('регресс: рабочие случаи не сломаны', () => {
  it('BHA при акне продолжает идти по рампе протокола, а не по общему тиру', () => {
    // Явная запись salicylic_acid в acne-протоколе должна совпадать с записью bha.
    for (const week of [1, 2, 3, 4]) {
      const bha = getEffectiveIngredientSchedule('bha', acne, week);
      const salicylic = getEffectiveIngredientSchedule('salicylic_acid', acne, week);
      expect(salicylic.frequency).toBe(bha.frequency);
    }
  });

  it('BHA-продукт при акне применяется по протоколу (не ежедневно и не 2/нед-заглушкой)', () => {
    const bhaLiquid = product(['salicylic_acid'], 'treatment', 'treatment');
    const counts = daysPerWeek(bhaLiquid, 'treatment_exfoliant_mild', acne, normalSkin);
    // Рампа акне 2→3→4→5 дней/нед: растёт и не схлопывается в ежедневное.
    expect(counts).toEqual([2, 3, 4, 5]);
  });

  it('титрация ретинола по слоту не затронута', () => {
    const retinolCounts = [1, 2, 3, 4].map((week) => {
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const dayIndex = (week - 1) * 7 + d + 1;
        if (isActiveStepAllowedOnDay('treatment_antiage', dayIndex, week, normal, normalSkin)) count++;
      }
      return count;
    });
    // Базовый протокол: retinol 1→2→3→4, cyclingRules every_other_day (3) как потолок.
    expect(retinolCounts).toEqual([1, 2, 3, 3]);
  });

  it('не-кислотные активы (ниацинамид) остаются ежедневными', () => {
    expect(daysPerWeek(product(['niacinamide']), 'serum_niacinamide')).toEqual([7, 7, 7, 7]);
  });
});

describe('мультикислотный продукт подчиняется самому строгому расписанию', () => {
  it('AHA+BHA тоник (прод-кейс Mizon id 674) не частотнее однокислотного', () => {
    // Раньше объединение дней делало мультикислотный продукт ЧАЩЕ однокислотного.
    const mixed = daysPerWeek(product(['aha', 'bha']), 'toner_hydrating');
    mixed.forEach((c) => expect(c).toBeLessThan(7));
  });
});

describe('реальные строки состава из прод-сида (якорь на конкретные планы)', () => {
  // Состав берётся из scripts/seed-products-120.ts и scripts/seed-goldapple-gapfill.ts.
  // Критично: у 641 состав НА РУССКОМ. Паттерны с \b по кириллице не срабатывали
  // (\b в JS — ASCII-only), extractActiveIngredients возвращал [], и титрация по продукту
  // молча ничего не капала. Эти тесты держат оба конца: извлечение + частоту.
  it('641 The Ordinary Glycolic 7% — «гликолевая кислота 7%» → glycolic_acid', () => {
    expect(extractActiveIngredients({ activeIngredients: ['гликолевая кислота 7%'] }))
      .toContain('glycolic_acid');
  });

  it('641 в слоте toner_soothing: было 7/7/7/7 → стало по тиру', () => {
    const p = product(['гликолевая кислота 7%']);
    expect(daysPerWeek(p, 'toner_soothing')).toEqual([2, 2, 3, 3]);
  });

  it('674 Mizon AHA & BHA — «AHA-кислоты»/«BHA» → aha + bha', () => {
    expect(extractActiveIngredients({ activeIngredients: ['AHA-кислоты', 'BHA'] }))
      .toEqual(expect.arrayContaining(['aha', 'bha']));
  });

  it('674 в ежедневном слоте больше не 7 дней в неделю', () => {
    const p = product(['AHA-кислоты', 'BHA']);
    daysPerWeek(p, 'toner_hydrating').forEach((c) => expect(c).toBeLessThan(7));
  });

  it('кириллица в составе вообще распознаётся (регресс на ASCII-only \\b)', () => {
    expect(extractActiveIngredients({ activeIngredients: ['ретинол'] })).toContain('retinol');
    expect(extractActiveIngredients({ activeIngredients: ['ниацинамид'] })).toContain('niacinamide');
    expect(extractActiveIngredients({ activeIngredients: ['салициловая кислота'] }))
      .toContain('salicylic_acid');
  });

  it('подчёркнутая форма состава распознаётся наравне с пробельной', () => {
    expect(extractActiveIngredients({ activeIngredients: ['salicylic_acid'] }))
      .toContain('salicylic_acid');
    expect(extractActiveIngredients({ activeIngredients: ['glycolic-acid'] }))
      .toContain('glycolic_acid');
  });
});

describe('распознавание новых кислот', () => {
  it('mandelic acid извлекается как отдельный актив', () => {
    expect(extractActiveIngredients({ activeIngredients: ['Mandelic Acid 10%'] }))
      .toContain('mandelic_acid');
  });

  it('глюконолактон и лактобионовая распознаются как PHA', () => {
    expect(extractActiveIngredients({ activeIngredients: ['gluconolactone'] })).toContain('pha');
    expect(extractActiveIngredients({ activeIngredients: ['лактобионовая кислота'] })).toContain('pha');
  });

  it('миндальная кислота по-русски', () => {
    expect(extractActiveIngredients({ activeIngredients: ['миндальная кислота'] }))
      .toContain('mandelic_acid');
  });
});

describe('маршрутизация: периодическая кислота уезжает в недельный блок', () => {
  it('гликолевая (потолок 3) из нейтрального тонер-слота — маршрутизируется', () => {
    expect(shouldRouteAcidToWeekly(product(['glycolic_acid']), 'toner_soothing', normal, normalSkin))
      .toBe(true);
  });

  it('641 с русским составом — маршрутизируется', () => {
    expect(shouldRouteAcidToWeekly(product(['гликолевая кислота 7%']), 'toner_soothing', normal, normalSkin))
      .toBe(true);
  });

  it('BHA при акне (потолок 5 = почти ежедневно) — НЕ маршрутизируется', () => {
    // Недельный блок показал бы её реже, чем требует протокол.
    expect(getMaxWeeklyFrequency('salicylic_acid', acne)).toBe(5);
    expect(shouldRouteAcidToWeekly(product(['salicylic_acid']), 'serum_hydrating', acne, normalSkin))
      .toBe(false);
  });

  it('PHA (ежедневно допустим) — НЕ маршрутизируется', () => {
    expect(getMaxWeeklyFrequency('pha', normal)).toBeNull();
    expect(shouldRouteAcidToWeekly(product(['gluconolactone']), 'toner_soothing', normal, normalSkin))
      .toBe(false);
  });

  it('миндальная (потолок 5) остаётся в ежедневной рутине под титрацией', () => {
    expect(shouldRouteAcidToWeekly(product(['mandelic acid']), 'toner_soothing', normal, normalSkin))
      .toBe(false);
  });

  it('чувствительная кожа: гликолевая тем более периодическая', () => {
    expect(shouldRouteAcidToWeekly(product(['glycolic_acid']), 'toner_soothing', normal, sensitiveSkin))
      .toBe(true);
  });

  it('НЕ трогаем очищение, SPF, маски и уже кислотные слоты', () => {
    const acid = product(['glycolic_acid']);
    expect(shouldRouteAcidToWeekly(acid, 'cleanser_deep', normal, normalSkin)).toBe(false);
    expect(shouldRouteAcidToWeekly(acid, 'spf_50_face', normal, normalSkin)).toBe(false);
    expect(shouldRouteAcidToWeekly(acid, 'mask_acid', normal, normalSkin)).toBe(false);
    expect(shouldRouteAcidToWeekly(acid, 'treatment_exfoliant_mild', normal, normalSkin)).toBe(false);
  });

  it('некислотный продукт из нейтрального слота не трогаем', () => {
    expect(shouldRouteAcidToWeekly(product(['hyaluronic_acid']), 'toner_hydrating', normal, normalSkin))
      .toBe(false);
    expect(shouldRouteAcidToWeekly(product(['niacinamide']), 'serum_niacinamide', normal, normalSkin))
      .toBe(false);
  });
});

describe('каденция для юзера', () => {
  it('подпись отражает ПОТОЛОК, а не точное число вхождений', () => {
    // Тир может разрешать 3, а недельный блок дать 2 слота — «3 раза в неделю»
    // обещало бы юзеру больше, чем в плане реально стоит.
    expect(formatWeeklyFrequencyLabel(1)).toBe('1 раз в неделю');
    expect(formatWeeklyFrequencyLabel(2)).toBe('до 2 раз в неделю');
    expect(formatWeeklyFrequencyLabel(3)).toBe('до 3 раз в неделю');
    expect(formatWeeklyFrequencyLabel(5)).toBe('до 5 раз в неделю');
  });
});

describe('каденция распространяется и на ретинол', () => {
  // У ретинола та же UX-дыра: он титруется 1→2→3 и так же исчезает из рутины в off-day.
  // Подпись считается по ВСЕМ титруемым активам, а кап недельного блока — только по кислотам.
  it('helper каденции возвращает расписание для ретинол-продукта', () => {
    const retinol = product(['retinol'], 'treatment', 'treatment');
    const freqs = [1, 2, 3, 4].map((week) =>
      getScheduledFrequencyForStep(retinol, 'treatment_antiage', normal, normalSkin, week)
    );
    freqs.forEach((f) => expect(f).not.toBeNull());
    expect(formatWeeklyFrequencyLabel(freqs[0] as number)).toBe('1 раз в неделю');
  });

  it('acidsOnly не учитывает ретинол — недельный cap остаётся кислотным', () => {
    const retinol = product(['retinol'], 'treatment', 'treatment');
    expect(
      getScheduledFrequencyForStep(retinol, 'treatment_antiage', normal, normalSkin, 1, {
        acidsOnly: true,
      })
    ).toBeNull();
  });

  it('у ниацинамида расписания нет — подписи не будет', () => {
    expect(getEffectiveIngredientSchedule('niacinamide', normal, 2).frequency).toBeNull();
  });
});
