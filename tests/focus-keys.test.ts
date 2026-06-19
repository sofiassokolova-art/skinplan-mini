import { describe, it, expect } from 'vitest';
import { deriveFocusKeys, goalsFromFocusKeys, FOCUS_TO_GOAL } from '@/lib/focus-keys';
import type { GoalKey } from '@/lib/concern-taxonomy';

// Реальные лейблы опций активной анкеты (skin_concerns / skin_goals).
// Если лейблы в БД изменятся — этот тест должен сломаться, чтобы заметить регресс.
const CONCERN_LABELS: Record<string, string> = {
  skin_concerns_1: 'Акне и высыпания',
  skin_concerns_2: 'Жирность, блеск и расширенные поры',
  skin_concerns_3: 'Сухость и стянутость',
  skin_concerns_4: 'Пигментация и неровный тон',
  skin_concerns_5: 'Морщины и возрастные изменения',
  skin_concerns_6: 'Чувствительность и покраснения',
  skin_concerns_7: 'Проблемы вокруг глаз (отёки, круги)',
  skin_concerns_8: 'В целом всё устраивает, нужен поддерживающий уход',
};
const GOAL_LABELS: Record<string, string> = {
  skin_goals_1: 'Сократить морщины и мелкие линии',
  skin_goals_2: 'Избавиться от акне и высыпаний',
  skin_goals_3: 'Сделать поры менее заметными',
  skin_goals_4: 'Уменьшить отёчность лица',
  skin_goals_5: 'Выровнять тон и пигментацию',
  skin_goals_6: 'Улучшить текстуру и гладкость кожи',
};

describe('deriveFocusKeys: лейблы беспокойств → канонические фокусы', () => {
  const cases: Array<[string, string[]]> = [
    ['skin_concerns_1', ['acne']],
    ['skin_concerns_2', ['pores', 'oiliness']],
    ['skin_concerns_3', ['dehydration']],
    ['skin_concerns_4', ['pigmentation']],
    ['skin_concerns_5', ['wrinkles']],
    ['skin_concerns_6', ['barrier']],
    ['skin_concerns_7', ['dark_circles']],
    ['skin_concerns_8', []],
  ];
  for (const [code, expected] of cases) {
    it(`${code} ("${CONCERN_LABELS[code]}") → [${expected.join(', ') || '∅'}]`, () => {
      const keys = [...deriveFocusKeys([CONCERN_LABELS[code]])].sort();
      expect(keys).toEqual([...expected].sort());
    });
  }
});

describe('deriveFocusKeys: лейблы целей → канонические фокусы', () => {
  const cases: Array<[string, string[]]> = [
    ['skin_goals_1', ['wrinkles']],
    ['skin_goals_2', ['acne']],
    ['skin_goals_3', ['pores']],
    ['skin_goals_4', []], // «Уменьшить отёчность лица» — нет выделенного фокуса
    ['skin_goals_5', ['pigmentation']],
    ['skin_goals_6', []], // «Улучшить текстуру» — нет выделенного фокуса
  ];
  for (const [code, expected] of cases) {
    it(`${code} ("${GOAL_LABELS[code]}") → [${expected.join(', ') || '∅'}]`, () => {
      const keys = [...deriveFocusKeys([GOAL_LABELS[code]])].sort();
      expect(keys).toEqual([...expected].sort());
    });
  }
});

describe('deriveFocusKeys: устойчивость и отсутствие ложных срабатываний', () => {
  it('«Уменьшить отёчность лица» НЕ триггерит dark_circles (это про глаза, а не лицо)', () => {
    expect(deriveFocusKeys(['Уменьшить отёчность лица']).has('dark_circles')).toBe(false);
  });

  it('сырые коды опций не дают фокусов (раньше именно так сигнал и терялся)', () => {
    expect([...deriveFocusKeys(['skin_concerns_5', 'skin_goals_1'])]).toEqual([]);
  });

  it('терпимо к регистру и латинским ключам', () => {
    expect(deriveFocusKeys(['WRINKLES']).has('wrinkles')).toBe(true);
    expect(deriveFocusKeys(['antiage']).has('wrinkles')).toBe(true);
  });

  it('null/undefined/пустые значения не падают и не дают фокусов', () => {
    expect([...deriveFocusKeys([null, undefined, ''])]).toEqual([]);
  });

  it('агрегирует несколько лейблов в объединение фокусов', () => {
    const keys = deriveFocusKeys(['Морщины и возрастные изменения', 'Проблемы вокруг глаз (отёки, круги)']);
    expect([...keys].sort()).toEqual(['dark_circles', 'wrinkles']);
  });
});

describe('goalsFromFocusKeys: фокусы → mainGoals (аддитивно)', () => {
  it('морщины → antiage', () => {
    expect(goalsFromFocusKeys(new Set(['wrinkles']), [])).toEqual(['antiage']);
  });

  it('тёмные круги → dark_circles', () => {
    expect(goalsFromFocusKeys(new Set(['dark_circles']), [])).toEqual(['dark_circles']);
  });

  it('oiliness не даёт цели', () => {
    expect(goalsFromFocusKeys(new Set(['oiliness']), [])).toEqual([]);
  });

  it('не дублирует уже существующие цели', () => {
    expect(goalsFromFocusKeys(new Set(['wrinkles']), ['antiage' as GoalKey])).toEqual([]);
  });

  it('возвращает только недостающие цели, без дублей', () => {
    const added = goalsFromFocusKeys(new Set(['acne', 'pores', 'wrinkles']), ['acne' as GoalKey]);
    expect(added.sort()).toEqual(['antiage', 'pores']);
  });

  it('кейс Елены: морщины+круги при пустых mainGoals → [antiage, dark_circles]', () => {
    const focusKeys = deriveFocusKeys([
      'Сократить морщины и мелкие линии',
      'Морщины и возрастные изменения',
      'Проблемы вокруг глаз (отёки, круги)',
    ]);
    expect(goalsFromFocusKeys(focusKeys, []).sort()).toEqual(['antiage', 'dark_circles']);
  });
});

describe('FOCUS_TO_GOAL: контракт маппинга', () => {
  it('каждый фокус с целью маппится в валидный GoalKey, oiliness отсутствует', () => {
    expect(FOCUS_TO_GOAL).toEqual({
      acne: 'acne',
      pores: 'pores',
      pigmentation: 'pigmentation',
      wrinkles: 'antiage',
      dehydration: 'dehydration',
      barrier: 'barrier',
      dark_circles: 'dark_circles',
    });
    expect(FOCUS_TO_GOAL.oiliness).toBeUndefined();
  });
});
