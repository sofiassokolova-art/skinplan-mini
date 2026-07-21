// tests/protocol-forbidden-ingredients.test.ts
// Регрессия прод-бага (Ольга, cmrp6kr01000004jui674wjgk): пользователю с розацеа
// в слот toner_soothing попал Glycolic Acid 7% Toning Solution (product 641), хотя
// протокол розацеа запрещает AHA/BHA/ретиноиды/витамин C/BPO.
//
// Цепочка пробоя была двойная:
//   1. protocol.forbiddenIngredients написаны «зонтиками» (`aha`), а активы продукта
//      извлекаются конкретными (`glycolic_acid`) — прямой includes() их не матчил;
//   2. запрет на СОСТАВ проверялся только при выборе шага (forbiddenSteps) и в
//      filterByProtocol, но не для продуктов из ensure-блоков/fallback'ов, которые
//      регистрировались в разрешённый протоколом слот напрямую.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';
import type { Plan28 } from '@/lib/plan-types';

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: mockFindMany,
    },
  },
}));

import {
  DERMATOLOGY_PROTOCOLS,
  isIngredientForbiddenByProtocol,
} from '@/lib/dermatology-protocols';
import {
  getProtocolForbiddenIngredients,
  productViolatesProtocol,
} from '@/lib/dermatology-product-filter';
import { findFallbackProductForSlot } from '@/lib/product-fallback';
import { validatePlanInvariants } from '@/lib/plan-invariants';

const ROSACEA = DERMATOLOGY_PROTOCOLS.rosacea;
const NORMAL = DERMATOLOGY_PROTOCOLS.normal;

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string }): ProductWithBrand {
  return {
    brand: { id: 1, name: 'Brand', isActive: true },
    step: 'toner',
    category: 'toner',
    price: null,
    imageUrl: null,
    isHero: false,
    priority: 0,
    skinTypes: [],
    published: true,
    activeIngredients: [],
    ...overrides,
  } as ProductWithBrand;
}

// Продукты из прод-каталога, попавшие в план Ольги
const glycolicToner = product({
  id: 641,
  name: 'Glycolic Acid 7% Toning Solution',
  activeIngredients: ['glycolic acid'],
  isHero: true,
  priority: 100,
});
const bhaToner = product({
  id: 674,
  name: 'BHA Blackhead Power Liquid',
  activeIngredients: ['salicylic acid'],
  priority: 90,
});
const centellaToner = product({
  id: 496,
  name: 'Centella Toner',
  activeIngredients: ['centella asiatica'],
});

const rosaceaProfile: ProfileClassification = {
  skinType: 'oily',
  concerns: [],
  diagnoses: ['розацеа'],
  sensitivityLevel: 'high',
} as ProfileClassification;

const plainProfile: ProfileClassification = {
  skinType: 'oily',
  concerns: [],
  diagnoses: [],
  sensitivityLevel: 'medium',
} as ProfileClassification;

/** Мок каталога: подтип-запросы матчим по вхождению подтипа в where, иначе отдаём базовый список */
function mockCatalog(catalog: ProductWithBrand[]) {
  mockFindMany.mockImplementation(async (args: any) => {
    const whereJson = JSON.stringify(args.where);
    for (const subtype of ['toner_soothing', 'toner_hydrating', 'toner_bha']) {
      if (whereJson.includes(subtype)) {
        return catalog.filter(
          (p) => (p.step || '').startsWith(subtype) || (p.category || '') === subtype
        );
      }
    }
    return catalog;
  });
}

describe('isIngredientForbiddenByProtocol: раскрытие «зонтичных» запретов', () => {
  it('запрет `aha` при розацеа покрывает конкретные AHA', () => {
    for (const ing of ['glycolic_acid', 'lactic_acid', 'mandelic_acid', 'aha'] as const) {
      expect(isIngredientForbiddenByProtocol(ing, ROSACEA)).toBe(true);
    }
  });

  it('запрет `bha`/`retinoid` покрывает salicylic_acid и третиноин/адапален', () => {
    expect(isIngredientForbiddenByProtocol('salicylic_acid', ROSACEA)).toBe(true);
    expect(isIngredientForbiddenByProtocol('tretinoin', ROSACEA)).toBe(true);
    expect(isIngredientForbiddenByProtocol('adapalene', ROSACEA)).toBe(true);
  });

  it('разрешённые при розацеа активы не считаются запрещёнными', () => {
    for (const ing of ['azelaic_acid', 'niacinamide', 'ceramides', 'hyaluronic_acid'] as const) {
      expect(isIngredientForbiddenByProtocol(ing, ROSACEA)).toBe(false);
    }
  });

  it('протокол без запретов (normal) ничего не блокирует', () => {
    expect(isIngredientForbiddenByProtocol('glycolic_acid', NORMAL)).toBe(false);
  });
});

describe('getProtocolForbiddenIngredients: проверка состава продукта', () => {
  it('ловит Glycolic Acid 7% для розацеа (кейс Ольги)', () => {
    expect(getProtocolForbiddenIngredients(glycolicToner, ROSACEA)).toContain('glycolic_acid');
    expect(productViolatesProtocol(glycolicToner, ROSACEA)).toBe(true);
  });

  it('ловит русский состав («гликолевая кислота»)', () => {
    const ruProduct = product({
      id: 999,
      name: 'Тоник с кислотой',
      activeIngredients: ['гликолевая кислота'],
    });
    expect(productViolatesProtocol(ruProduct, ROSACEA)).toBe(true);
  });

  it('не блокирует нейтральные и разрешённые продукты', () => {
    expect(productViolatesProtocol(centellaToner, ROSACEA)).toBe(false);
    expect(
      productViolatesProtocol(
        product({ id: 1000, name: 'Azelaic 10%', activeIngredients: ['azelaic acid'] }),
        ROSACEA
      )
    ).toBe(false);
  });

  it('при пустых activeIngredients определяет актив по слоту', () => {
    const unmarked = product({ id: 1001, name: 'Unmarked toner', activeIngredients: [] });
    expect(productViolatesProtocol(unmarked, ROSACEA, 'toner_bha')).toBe(true);
    expect(productViolatesProtocol(unmarked, ROSACEA, 'toner_soothing')).toBe(false);
  });

  it('тот же кислотный тонер допустим при протоколе без запретов', () => {
    expect(productViolatesProtocol(glycolicToner, NORMAL)).toBe(false);
  });
});

describe('findFallbackProductForSlot: protocol-aware гейт', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('(а) розацеа + пустая подборка тонера → кислотный тонер не возвращается', async () => {
    mockCatalog([glycolicToner, bhaToner, centellaToner]);

    const result = await findFallbackProductForSlot('toner_soothing', rosaceaProfile, {
      userId: 'cmrp6kr01000004jui674wjgk',
      protocol: ROSACEA,
    });

    expect(result).not.toBeNull();
    expect([641, 674]).not.toContain(result!.id);
    expect(result!.id).toBe(centellaToner.id);
  });

  it('розацеа + в каталоге только кислотные тонеры → null, а не кислота', async () => {
    mockCatalog([glycolicToner, bhaToner]);

    const result = await findFallbackProductForSlot('toner_soothing', rosaceaProfile, {
      userId: 'cmrp6kr01000004jui674wjgk',
      protocol: ROSACEA,
    });

    expect(result).toBeNull();
  });

  it('гейт протокола работает и в кислотном слоте (toner_bha при розацеа)', async () => {
    mockCatalog([product({ id: 800, name: 'BHA Liquid', step: 'toner_bha', activeIngredients: ['bha'] })]);

    const result = await findFallbackProductForSlot('toner_bha', rosaceaProfile, {
      protocol: ROSACEA,
    });

    expect(result).toBeNull();
  });

  it('(в) не-розацеа профиль по-прежнему получает тонер (нет регрессии в пустой слот)', async () => {
    mockCatalog([glycolicToner, bhaToner, centellaToner]);

    const result = await findFallbackProductForSlot('toner_hydrating', plainProfile, {
      userId: 'cmrp6kr01000004jui674wjgk',
      protocol: NORMAL,
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(centellaToner.id);
  });

  it('не-розацеа профиль получает кислотный тонер в кислотный слот', async () => {
    const acidSlotToner = product({
      id: 800,
      name: 'BHA Liquid',
      step: 'toner_bha',
      activeIngredients: ['bha'],
    });
    mockCatalog([acidSlotToner, centellaToner]);

    const result = await findFallbackProductForSlot('toner_bha', plainProfile, { protocol: NORMAL });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(acidSlotToner.id);
  });
});

describe('validatePlanInvariants: инвариант protocol_forbidden_ingredient', () => {
  function planWithToner(productId: string): Plan28 {
    return {
      days: [
        {
          dayIndex: 1,
          morning: [{ stepCategory: 'toner_soothing', productId }],
          evening: [],
          weekly: [],
        },
      ],
    } as unknown as Plan28;
  }

  it('(б) ловит запрещённый протоколом актив в любом дне плана', () => {
    const violations = validatePlanInvariants(
      planWithToner('641'),
      new Map([['641', { id: 641, name: glycolicToner.name, step: 'toner', activeIngredients: ['glycolic acid'] }]]),
      ROSACEA
    );

    const protocolViolations = violations.filter((v) => v.issue === 'protocol_forbidden_ingredient');
    expect(protocolViolations).toHaveLength(1);
    expect(protocolViolations[0].productId).toBe('641');
    expect(protocolViolations[0].detail).toContain('glycolic_acid');
  });

  it('чистый продукт нарушений не даёт', () => {
    const violations = validatePlanInvariants(
      planWithToner('496'),
      new Map([['496', { id: 496, name: centellaToner.name, step: 'toner', activeIngredients: ['centella asiatica'] }]]),
      ROSACEA
    );

    expect(violations.filter((v) => v.issue === 'protocol_forbidden_ingredient')).toHaveLength(0);
  });

  it('без протокола проверка не выполняется (обратная совместимость)', () => {
    const violations = validatePlanInvariants(
      planWithToner('641'),
      new Map([['641', { id: 641, name: glycolicToner.name, step: 'toner', activeIngredients: ['glycolic acid'] }]])
    );

    expect(violations.filter((v) => v.issue === 'protocol_forbidden_ingredient')).toHaveLength(0);
  });
});
