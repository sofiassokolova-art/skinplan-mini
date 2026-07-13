// tests/rx-topicals.test.ts
// Rx-терапия акне (кейс Галимат): пользователь на Эффезеле/Базироне/Дифферине
// не должен получать в плане дополнительные кислоты/анти-акне активы поверх
// препарата врача. Логика вынесена в lib/rx-topicals.ts из plan-generator.

import { describe, it, expect } from 'vitest';
import type { StepCategory } from '@/lib/step-category-rules';
import {
  isOnStrongRxTopicals,
  filterStepsForRxTopicals,
  RX_TOPICAL_CONFLICT_STEPS,
} from '@/lib/rx-topicals';

describe('isOnStrongRxTopicals', () => {
  it('true для benzoyl_peroxide (Эффезел/Базирон) и topical_retinoids (Дифферин)', () => {
    expect(isOnStrongRxTopicals(['benzoyl_peroxide'])).toBe(true);
    expect(isOnStrongRxTopicals(['topical_retinoids'])).toBe(true);
    expect(isOnStrongRxTopicals(['azelaic_acid', 'benzoyl_peroxide'])).toBe(true);
  });

  it('false для слабых/других топикалов и пустых значений', () => {
    expect(isOnStrongRxTopicals(['azelaic_acid'])).toBe(false);
    expect(isOnStrongRxTopicals([])).toBe(false);
    expect(isOnStrongRxTopicals(null)).toBe(false);
    expect(isOnStrongRxTopicals(undefined)).toBe(false);
  });

  it('терпит мусор в medicalMarkers (не-массив, не-строки)', () => {
    expect(isOnStrongRxTopicals('benzoyl_peroxide')).toBe(false); // строка, не массив
    expect(isOnStrongRxTopicals([42, null, { a: 1 }])).toBe(false);
  });
});

describe('filterStepsForRxTopicals', () => {
  const eveningSteps: StepCategory[] = [
    'cleanser_gentle',
    'toner_acid',
    'treatment_acne_azelaic',
    'moisturizer_light',
  ];

  it('без Rx-терапии шаги не трогаются', () => {
    expect(filterStepsForRxTopicals(eveningSteps, false)).toEqual(eveningSteps);
  });

  it('на Rx-терапии убирает кислоты и анти-акне активы, оставляя базу', () => {
    expect(filterStepsForRxTopicals(eveningSteps, true)).toEqual([
      'cleanser_gentle',
      'moisturizer_light',
    ]);
  });

  it('регрессия Галимат: азелаинка не наслаивается поверх Эффезела', () => {
    const filtered = filterStepsForRxTopicals(
      ['treatment_acne_azelaic', 'treatment_acne_bpo'],
      isOnStrongRxTopicals(['benzoyl_peroxide'])
    );
    expect(filtered).toEqual([]);
  });

  it('все конфликтные шаги — реальные кислотные/лечебные категории, база не задета', () => {
    // Санити: в конфликт-листе нет базовых шагов (cleanser/moisturizer/spf),
    // иначе Rx-пользователь остался бы без базового ухода.
    for (const step of RX_TOPICAL_CONFLICT_STEPS) {
      expect(step).toMatch(/^(treatment|serum|toner|mask)_/);
      expect(step).not.toMatch(/^(cleanser|moisturizer|spf)/);
    }
  });
});
