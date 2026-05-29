// tests/ingredient-pairs.test.ts
// P1.4: Базовое покрытие самых частых конфликтных пар активов.
// Эти проверки регрессно ловят случай «один продукт содержит retinol, другой AHA,
// и плановщик случайно положил оба в evening» — самый распространённый источник
// «retinoid uglies» в первую неделю использования. До этого матрица INGREDIENT_CONFLICTS
// тестами не покрывалась — был только integration smoke на план.

import { describe, it, expect } from 'vitest';
import {
  checkProductCompatibility,
  canUseTogether,
  checkIngredientDuplication,
  getOptimalTimeOfDay,
  extractActiveIngredients,
} from '@/lib/ingredient-compatibility';

const p = (ingredients: string[]) => ({ activeIngredients: ingredients });

describe('checkProductCompatibility — конфликты пар', () => {
  // Раньше тут был [KNOWN BUG]: glycolic_acid не разворачивался в группу 'aha'.
  // Фикс: expandIngredientForMatching раскрывает зонтичные ингредиенты.
  it('retinol + glycolic_acid (через раскрытие группы aha) → high severity, separate_time', () => {
    const c = checkProductCompatibility(p(['retinol']), p(['glycolic acid']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('high');
    expect(c?.solution).toBe('separate_time');
  });

  // Раньше .skip с [KNOWN BUG] — теперь должно работать через раскрытие групп.
  it('retinol + salicylic_acid (через раскрытие группы bha) → high severity', () => {
    const c = checkProductCompatibility(p(['retinol']), p(['salicylic acid']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('high');
  });

  it('tretinoin + glycolic_acid (через раскрытие группы aha) → high severity', () => {
    const c = checkProductCompatibility(p(['tretinoin']), p(['glycolic acid']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('high');
  });

  // Зелёный позитивный кейс: когда конфликтная матрица оперирует именованной группой —
  // помечаем продукт явным "aha"/"bha", тогда конфликт срабатывает.
  it('retinol + aha (с явной группой) → high severity, separate_time', () => {
    const c = checkProductCompatibility(p(['retinol']), p(['aha']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('high');
    expect(c?.solution).toBe('separate_time');
  });

  it('vitamin_c + niacinamide → medium severity, warning (НЕ блок)', () => {
    const c = checkProductCompatibility(p(['niacinamide']), p(['vitamin c']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('medium');
    expect(c?.solution).toBe('warning');
  });

  it('ascorbic_acid (низкий pH) + niacinamide → separate_time (более строго)', () => {
    const c = checkProductCompatibility(p(['ascorbic acid']), p(['niacinamide']));
    expect(c).not.toBeNull();
    expect(c?.solution).toBe('separate_time');
  });

  it('retinol + vitamin_c → medium severity, separate_time', () => {
    const c = checkProductCompatibility(p(['retinol']), p(['vitamin c']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('medium');
    expect(c?.solution).toBe('separate_time');
  });

  it('benzoyl_peroxide + retinol → high severity', () => {
    const c = checkProductCompatibility(p(['retinol']), p(['benzoyl peroxide']));
    expect(c).not.toBeNull();
    expect(c?.severity).toBe('high');
  });

  it('safe pair: ceramides + niacinamide → no conflict', () => {
    const c = checkProductCompatibility(p(['ceramides']), p(['niacinamide']));
    expect(c).toBeNull();
  });

  it('safe pair: hyaluronic acid + peptides → no conflict', () => {
    const c = checkProductCompatibility(p(['hyaluronic acid']), p(['peptides']));
    expect(c).toBeNull();
  });
});

describe('canUseTogether — стек в одно время суток', () => {
  // ПРИМЕЧАНИЕ: canUseTogether использует getOptimalTimeOfDay и отдельную логику
  // «можно ли держать оба в одном слоте». При severity=high+solution=separate_time
  // конфликт всё равно может попасть в conflicts[], но compatible может остаться true,
  // если оба продукта де-факто принадлежат разным слотам. Тестируем checkProductCompatibility
  // выше — это надёжнее для матрицы конфликтов.

  it('niacinamide + ceramides утром → совместимы (нет конфликта в матрице)', () => {
    const r = canUseTogether(p(['niacinamide']), [p(['ceramides'])], 'morning', 'medium');
    expect(r.compatible).toBe(true);
    expect(r.conflicts.length).toBe(0);
  });
});

describe('checkIngredientDuplication', () => {
  it('два retinoid-продукта в одном дне → дубликат', () => {
    const dups = checkIngredientDuplication([p(['retinol']), p(['tretinoin']), p(['niacinamide'])]);
    const retinoidDup = dups.find(d => d.group === 'retinoids');
    expect(retinoidDup).toBeDefined();
    expect(retinoidDup?.products.length).toBe(2);
  });

  it('два кислотных продукта (AHA + BHA) → дубликат по группе acids', () => {
    const dups = checkIngredientDuplication([p(['glycolic acid']), p(['salicylic acid'])]);
    expect(dups.find(d => d.group === 'acids')).toBeDefined();
  });

  it('один ретинол + один ниацинамид → нет дублирования', () => {
    const dups = checkIngredientDuplication([p(['retinol']), p(['niacinamide'])]);
    expect(dups).toEqual([]);
  });
});

describe('getOptimalTimeOfDay', () => {
  it('retinol → evening', () => {
    expect(getOptimalTimeOfDay(p(['retinol']))).toBe('evening');
  });
  it('vitamin C → morning', () => {
    expect(getOptimalTimeOfDay(p(['vitamin c']))).toBe('morning');
  });
  it('azelaic acid + very_high sensitivity → morning (мягче)', () => {
    expect(getOptimalTimeOfDay(p(['azelaic acid']), 'very_high')).toBe('morning');
  });
});

describe('extractActiveIngredients (нормализация)', () => {
  it('распознаёт латинский retinol с word boundary', () => {
    expect(extractActiveIngredients({ activeIngredients: ['retinol'] })).toContain('retinol');
  });
  it('распознаёт salicylic acid', () => {
    expect(extractActiveIngredients({ activeIngredients: ['salicylic acid'] })).toContain('salicylic_acid');
  });
  it('распознаёт glycolic acid', () => {
    expect(extractActiveIngredients({ activeIngredients: ['glycolic acid'] })).toContain('glycolic_acid');
  });
});
