import { describe, it, expect } from 'vitest';
import { mapStepToStepCategory } from '@/lib/step-matching';
import { getStepTypeFromCategory, StepType } from '@/lib/step-type';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';
import { isProductAllowedInPlanPhase } from '@/lib/plan-generator';
import type { StepCategory } from '@/lib/step-category-rules';

const balmStep = 'balm_barrier_repair' as StepCategory;

describe('регрессия: balm_barrier_repair заполнялся сывороткой', () => {
  it('базовый тип balm_barrier_repair — balm, а не дефолтный serum', () => {
    // Раньше getStepTypeFromCategory проваливался в дефолт SERUM, из-за чего все
    // fallback-пути (ensureRequiredProducts, getProductsForStep, findFallbackProduct)
    // искали для balm-слота сыворотку: в план попадал дубль serum_hydrating
    // (adaptation/recovery) или serum_vitc (active-фаза).
    expect(getStepTypeFromCategory(balmStep)).toBe(StepType.BALM);
    expect(getBaseStepFromStepCategory(balmStep)).toBe('balm');
  });

  it('продукт со step=balm_barrier_repair маппится в balm-слот и никуда больше', () => {
    const mapped = mapStepToStepCategory('balm_barrier_repair', null);
    expect(mapped).toContain('balm_barrier_repair');
    expect(mapped.filter((c) => c.startsWith('serum'))).toHaveLength(0);
    expect(mapped.filter((c) => c.startsWith('moisturizer'))).toHaveLength(0);
  });

  it('лип-бальзам не регистрируется как барьерный бальзам для лица', () => {
    expect(mapStepToStepCategory('lip_balm', 'lip_care')).not.toContain('balm_barrier_repair');
    expect(mapStepToStepCategory('lip_care', 'balm')).not.toContain('balm_barrier_repair');
  });

  it('восстанавливающий бальзам разрешён в balm-слоте во всех фазах', () => {
    const cicaBalm = { activeIngredients: ['пантенол', 'центелла', 'madecassoside'] };
    expect(isProductAllowedInPlanPhase(cicaBalm, 'adaptation', balmStep)).toBe(true);
    expect(isProductAllowedInPlanPhase(cicaBalm, 'active', balmStep)).toBe(true);
    expect(isProductAllowedInPlanPhase(cicaBalm, 'support', balmStep)).toBe(true);
  });

  it('активы (vit C, ретинол, кислоты) не проходят в balm-слот ни в одной фазе', () => {
    const vitcSerum = { activeIngredients: ['vitamin c', 'ferulic acid'] };
    const retinolCream = { activeIngredients: ['ретинол'] };
    for (const phase of ['adaptation', 'active', 'support'] as const) {
      expect(isProductAllowedInPlanPhase(vitcSerum, phase, balmStep)).toBe(false);
      expect(isProductAllowedInPlanPhase(retinolCream, phase, balmStep)).toBe(false);
    }
  });
});
