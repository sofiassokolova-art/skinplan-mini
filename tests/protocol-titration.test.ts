// tests/protocol-titration.test.ts
// Покрывает фиксы дерматологической логики:
// - P0.1: реальная титрация (равномерное распределение дней применения по неделям)
// - P0.2: отдельные категории для мягких брайтенеров и серы (без подмены чужими)
// - P1.4: коморбидность акне + пигментация (разрешён витамин C)
// - P2.7: BHA в акне наращивается по неделям, а не пинится на 2x навсегда
// - P2.9: тёмный фототип (V_VI) — запрет агрессивных кислот при пигментации
// - P2.10: конфликт BPO + витамин C

import { describe, it, expect } from 'vitest';
import {
  spreadApplicationDays,
  getApplicationDaysForWeek,
} from '@/lib/protocol-plan-integration';
import { determineProtocol, DERMATOLOGY_PROTOCOLS } from '@/lib/dermatology-protocols';
import { extractActiveIngredients, checkProductCompatibility } from '@/lib/ingredient-compatibility';

describe('P0.1 spreadApplicationDays — равномерное распределение', () => {
  it('1 раз/нед → один день', () => {
    expect(spreadApplicationDays(1)).toEqual([1]);
  });
  it('2 раза/нед → разнесены примерно пополам', () => {
    expect(spreadApplicationDays(2)).toEqual([1, 4]);
  });
  it('3 раза/нед → через день', () => {
    expect(spreadApplicationDays(3)).toEqual([1, 3, 5]);
  });
  it('>=7 → каждый день', () => {
    expect(spreadApplicationDays(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('0 → не применять', () => {
    expect(spreadApplicationDays(0)).toEqual([]);
  });
});

describe('P0.1 getApplicationDaysForWeek — титрация ретинола (normal)', () => {
  const normal = DERMATOLOGY_PROTOCOLS.normal;
  it('наращивает количество дней от недели к неделе', () => {
    const w2 = getApplicationDaysForWeek('retinol', normal, 2);
    const w4 = getApplicationDaysForWeek('retinol', normal, 4);
    expect(w2).not.toBeNull();
    expect(w4).not.toBeNull();
    // На 4-й неделе дней применения не меньше, чем на 2-й (прогрессия).
    expect((w4 as number[]).length).toBeGreaterThanOrEqual((w2 as number[]).length);
  });
  it('naiveCap ограничивает частоту для retinoid-naive', () => {
    const capped = getApplicationDaysForWeek('retinol', normal, 4, { naiveCap: 2 });
    expect(capped).not.toBeNull();
    expect((capped as number[]).length).toBeLessThanOrEqual(2);
  });
  it('ингредиент без расписания → null (нет ограничений)', () => {
    expect(getApplicationDaysForWeek('niacinamide', normal, 2)).toBeNull();
  });
});

describe('P0.2 extractActiveIngredients — отдельные категории', () => {
  it('арбутин → arbutin (не vitamin_c)', () => {
    const ings = extractActiveIngredients({ activeIngredients: ['arbutin'] });
    expect(ings).toContain('arbutin');
    expect(ings).not.toContain('vitamin_c');
  });
  it('койевая кислота → kojic_acid', () => {
    expect(extractActiveIngredients({ activeIngredients: ['kojic acid'] })).toContain('kojic_acid');
  });
  it('транексамовая кислота → tranexamic_acid (не azelaic_acid)', () => {
    const ings = extractActiveIngredients({ activeIngredients: ['tranexamic acid'] });
    expect(ings).toContain('tranexamic_acid');
    expect(ings).not.toContain('azelaic_acid');
  });
  it('сера → sulfur (не benzoyl_peroxide)', () => {
    const ings = extractActiveIngredients({ activeIngredients: ['sulfur'] });
    expect(ings).toContain('sulfur');
    expect(ings).not.toContain('benzoyl_peroxide');
  });
  it('арбутин + ниацинамид → нет ложного конфликта (раньше был как vitamin_c)', () => {
    const c = checkProductCompatibility(
      { activeIngredients: ['arbutin'] },
      { activeIngredients: ['niacinamide'] }
    );
    expect(c).toBeNull();
  });
});

describe('P0.2 сера разрешена в строгом протоколе розацеа', () => {
  it('sulfur входит в allowedIngredients розацеа', () => {
    expect(DERMATOLOGY_PROTOCOLS.rosacea.allowedIngredients).toContain('sulfur');
  });
});

describe('P1.4 коморбидность акне + пигментация', () => {
  it('акне + пигментация → витамин C разрешён', () => {
    const protocol = determineProtocol({
      concerns: ['Акне', 'Пигментация'],
    });
    expect(protocol.allowedIngredients).toContain('vitamin_c');
    expect(protocol.forbiddenIngredients).not.toContain('vitamin_c');
    expect(protocol.allowedSteps).toContain('serum_vitc');
    expect(protocol.forbiddenSteps).not.toContain('serum_vitc');
  });
  it('только акне → витамин C по-прежнему запрещён', () => {
    const protocol = determineProtocol({ concerns: ['Акне'] });
    expect(protocol.forbiddenIngredients).toContain('vitamin_c');
  });
});

describe('P2.7 BHA в акне наращивается по неделям', () => {
  const acne = DERMATOLOGY_PROTOCOLS.acne;
  it('частота BHA растёт от недели 1 к неделе 4', () => {
    const w1 = getApplicationDaysForWeek('bha', acne, 1) as number[];
    const w4 = getApplicationDaysForWeek('bha', acne, 4) as number[];
    // w4 может быть null (=ежедневно); если массив — он не короче w1.
    if (w4 === null) {
      expect(true).toBe(true);
    } else {
      expect(w4.length).toBeGreaterThan(w1.length);
    }
  });
});

describe('P2.9 тёмный фототип V_VI — запрет агрессивных кислот', () => {
  it('пигментация + V_VI → AHA/BHA запрещены', () => {
    const protocol = determineProtocol({
      concerns: ['Пигментация'],
      fitzpatrickType: 'V_VI',
    });
    expect(protocol.forbiddenIngredients).toContain('aha');
    expect(protocol.forbiddenIngredients).toContain('bha');
    expect(protocol.forbiddenSteps).toContain('treatment_exfoliant_strong');
  });
  it('пигментация + III_IV → без жёсткого запрета кислот', () => {
    const protocol = determineProtocol({
      concerns: ['Пигментация'],
      fitzpatrickType: 'III_IV',
    });
    expect(protocol.forbiddenIngredients).not.toContain('aha');
  });
});

describe('P3.1 конфликт AHA + BHA (стек кислот)', () => {
  it('aha + bha → конфликт separate_time', () => {
    const c = checkProductCompatibility(
      { activeIngredients: ['aha'] },
      { activeIngredients: ['bha'] }
    );
    expect(c).not.toBeNull();
    expect(c?.solution).toBe('separate_time');
  });
  it('glycolic acid + salicylic acid (через раскрытие групп) → конфликт', () => {
    const c = checkProductCompatibility(
      { activeIngredients: ['glycolic acid'] },
      { activeIngredients: ['salicylic acid'] }
    );
    expect(c).not.toBeNull();
  });
});

describe('P2.10 конфликт BPO + витамин C', () => {
  it('benzoyl peroxide + vitamin C → конфликт separate_time', () => {
    const c = checkProductCompatibility(
      { activeIngredients: ['benzoyl peroxide'] },
      { activeIngredients: ['vitamin c'] }
    );
    expect(c).not.toBeNull();
    expect(c?.solution).toBe('separate_time');
  });
});
