import { describe, it, expect } from 'vitest';
import {
  matchCondition,
  concernLabelsToRuleTokens,
  treatmentSignalsToProductConcerns,
  deriveTreatmentSignalsForRuleContext,
  deriveTreatmentConcernsForRuleContext,
} from '@/lib/recommendations-generator';

// Регрессия: { gte, lte } в одном объекте — это ДИАПАЗОН. Раньше ветка gte делала
// return сразу, и верхняя граница lte молча игнорировалась (правило ловило значения
// выше lte). Проверяем, что обе границы учитываются через AND.
describe('matchCondition: числовые границы', () => {
  it('диапазон gte+lte учитывает ОБЕ границы', () => {
    const range = { gte: 30, lte: 65 };
    expect(matchCondition(range, 30)).toBe(true); // нижняя граница включительно
    expect(matchCondition(range, 50)).toBe(true); // внутри
    expect(matchCondition(range, 65)).toBe(true); // верхняя граница включительно
    expect(matchCondition(range, 29)).toBe(false); // ниже
    expect(matchCondition(range, 66)).toBe(false); // выше — раньше ошибочно true
    expect(matchCondition(range, 100)).toBe(false); // явно выше — раньше ошибочно true
  });

  it('строгий диапазон gt+lt', () => {
    const range = { gt: 0, lt: 3 };
    expect(matchCondition(range, 0)).toBe(false);
    expect(matchCondition(range, 1)).toBe(true);
    expect(matchCondition(range, 2)).toBe(true);
    expect(matchCondition(range, 3)).toBe(false);
  });

  it('одиночные границы по-прежнему работают', () => {
    expect(matchCondition({ gte: 60 }, 70)).toBe(true);
    expect(matchCondition({ gte: 60 }, 59)).toBe(false);
    expect(matchCondition({ lte: 40 }, 40)).toBe(true);
    expect(matchCondition({ lte: 40 }, 41)).toBe(false);
  });

  it('null/undefined значение не матчит числовые границы', () => {
    expect(matchCondition({ gte: 30, lte: 65 }, null)).toBe(false);
    expect(matchCondition({ gte: 30 }, undefined)).toBe(false);
  });

  it('нечисловое значение не матчит границы', () => {
    expect(matchCondition({ gte: 30, lte: 65 }, 'abc')).toBe(false);
  });
});

describe('matchCondition: прочие операторы (sanity)', () => {
  it('массив = in', () => {
    expect(matchCondition(['35-44', '45-54'], '45-54')).toBe(true);
    expect(matchCondition(['35-44'], '25-34')).toBe(false);
  });
  it('hasSome по массиву профиля', () => {
    expect(matchCondition({ hasSome: ['rosacea'] }, ['acne', 'rosacea'])).toBe(true);
    expect(matchCondition({ hasSome: ['rosacea'] }, ['acne'])).toBe(false);
  });
  it('пустой профиль (null) не матчит hasSome', () => {
    expect(matchCondition({ hasSome: ['rosacea'] }, null)).toBe(false);
  });
  it('equals', () => {
    expect(matchCondition({ equals: 'combo' }, 'combo')).toBe(true);
    expect(matchCondition('55+', '55+')).toBe(true);
  });
});

describe('concernLabelsToRuleTokens: лейблы анкеты → токены правил', () => {
  it('«Следы от акне (постакне)» → postacne_scars (не acne!)', () => {
    expect(concernLabelsToRuleTokens(['Следы от акне (постакне)'])).toEqual(['postacne_scars']);
  });
  it('«Акне и высыпания» → acne', () => {
    expect(concernLabelsToRuleTokens(['Акне и высыпания'])).toEqual(['acne']);
  });
  it('основные лейблы v2 мапятся в доменные токены', () => {
    expect(concernLabelsToRuleTokens([
      'Пигментация и неровный тон',
      'Морщины и возрастные изменения',
      'Сухость и стянутость',
      'Жирность, блеск и расширенные поры',
      'Чувствительность и покраснения',
    ])).toEqual(['pigmentation', 'wrinkles', 'dehydration', 'pores', 'sensitivity']);
  });
  it('postacne + acne вместе дают оба токена без коллизии', () => {
    const t = concernLabelsToRuleTokens(['Акне и высыпания', 'Следы от акне (постакне)']);
    expect(t).toContain('acne');
    expect(t).toContain('postacne_scars');
  });
  it('нераспознанный лейбл и пустой ввод', () => {
    expect(concernLabelsToRuleTokens(['Проблемы вокруг глаз (отёки, круги)'])).toEqual([]);
    expect(concernLabelsToRuleTokens(null)).toEqual([]);
    expect(concernLabelsToRuleTokens([])).toEqual([]);
  });
});

describe('treatmentSignalsToProductConcerns', () => {
  it('antiage/wrinkles ищут и photoaging, и wrinkles-разметку каталога', () => {
    expect(treatmentSignalsToProductConcerns(['antiage', 'wrinkles'])).toEqual([
      'wrinkles',
      'photoaging',
      'antiage',
    ]);
  });

  it('сохраняет релевантность для acne/pores без дублей', () => {
    expect(treatmentSignalsToProductConcerns(['pores', 'oiliness', 'acne'])).toEqual([
      'oiliness',
      'pores',
      'acne',
    ]);
  });
});

describe('deriveTreatmentSignalsForRuleContext', () => {
  it('не добавляет treatment для молодой жирной профилактики antiage/pores по goals', () => {
    const context = {
      skin_type: 'oily',
      age: '25-34',
      goals: ['antiage', 'pores'],
      concerns: [],
      oiliness: 90,
      photoaging: 15,
      acneLevel: 0,
      pigmentationRisk: 'low',
    } as any;

    expect(deriveTreatmentSignalsForRuleContext(context)).toEqual([]);
    expect(deriveTreatmentConcernsForRuleContext(context)).toEqual([]);
  });

  it('оставляет treatment при объективном акне, даже если возраст молодой', () => {
    expect(deriveTreatmentSignalsForRuleContext({
      age: 'under_25',
      goals: ['pores'],
      concerns: [],
      acneLevel: 2,
      inflammation: 35,
    } as any)).toEqual(['acne']);
  });

  it('pores-goal сам по себе не становится treatment даже при жирной коже', () => {
    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: ['pores'],
      concerns: [],
      oiliness: 80,
      sensitivity_level: 'low',
    } as any)).toEqual([]);
  });

  it('pores-concern становится treatment только без реактивности', () => {
    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: [],
      concerns: ['pores'],
      sensitivity_level: 'low',
    } as any)).toEqual(['pores']);

    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: [],
      concerns: ['pores'],
      oiliness: 80,
      sensitivity_level: 'high',
    } as any)).toEqual([]);
  });

  it('antiage-goal у 35+ и высокий photoaging дают antiage-treatment', () => {
    expect(deriveTreatmentSignalsForRuleContext({
      age: '35-44',
      goals: ['antiage'],
      concerns: [],
      photoaging: 30,
    } as any)).toEqual(['antiage']);

    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: ['antiage'],
      concerns: [],
      photoaging: 65,
    } as any)).toEqual(['antiage']);
  });

  it('пигментация по risk/score остается показанием к treatment', () => {
    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: [],
      concerns: [],
      pigmentationRisk: 'medium',
      pigmentation: 10,
    } as any)).toEqual(['pigmentation']);

    expect(deriveTreatmentSignalsForRuleContext({
      age: '25-34',
      goals: [],
      concerns: [],
      pigmentationRisk: 'low',
      pigmentation: 55,
    } as any)).toEqual(['pigmentation']);
  });
});
