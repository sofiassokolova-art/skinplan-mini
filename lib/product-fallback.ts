// lib/product-fallback.ts
// Логика поиска fallback продуктов для шагов ухода

import { prisma } from './db';
import type { StepCategory } from './step-category-rules';
import { getBaseStepFromStepCategory } from './plan-helpers';
import { logger } from './logger';
import { MIN_PRODUCTS_FOR_STEP } from './constants';
import type { Prisma } from '@prisma/client';
import type { ProfileClassification } from './plan-generation-helpers';

export interface ProductWithBrand {
  id: number;
  name: string;
  brand: {
    id: number;
    name: string;
    isActive: boolean;
  };
  step: string;
  category: string | null;
  price: number | null;
  imageUrl: string | null;
  isHero: boolean;
  priority: number;
  skinTypes: string[];
  published: boolean;
}

// ProfileClassification импортируется из plan-generation-helpers.ts

/**
 * Ищет fallback продукт для базового шага
 */
export async function findFallbackProduct(
  baseStep: string,
  profileClassification: ProfileClassification
): Promise<ProductWithBrand | null> {
  const whereClause: Prisma.ProductWhereInput = {
    published: true,
    brand: {
      isActive: true,
    },
  };

  // SPF универсален для всех типов кожи
  if (baseStep === 'spf') {
    whereClause.OR = [
      { step: 'spf' },
      { category: 'spf' },
    ];
  } else {
    whereClause.step = baseStep;

    // Для других шагов учитываем тип кожи
    if (profileClassification.skinType && baseStep !== 'spf') {
      const existingAND = Array.isArray(whereClause.AND) 
        ? whereClause.AND 
        : whereClause.AND 
          ? [whereClause.AND] 
          : [];
      
      whereClause.AND = [
        ...existingAND,
        {
          OR: [
            { skinTypes: { has: profileClassification.skinType } },
            { skinTypes: { isEmpty: true } },
          ],
        },
      ];
    }
  }

  try {
    const product = await prisma.product.findFirst({
      where: whereClause,
      include: {
        brand: true,
      },
      orderBy: [
        { isHero: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!product) {
      logger.warn('Fallback product not found', {
        baseStep,
        skinType: profileClassification.skinType,
      });
      return null;
    }

    return product as ProductWithBrand;
  } catch (error) {
    logger.error('Error finding fallback product', {
      error,
      baseStep,
    });
    return null;
  }
}

/**
 * Ищет fallback продукты для нескольких шагов одним запросом (batch)
 */
export async function findFallbackProductsBatch(
  baseSteps: string[],
  profileClassification: ProfileClassification
): Promise<Map<string, ProductWithBrand>> {
  const result = new Map<string, ProductWithBrand>();

  if (baseSteps.length === 0) {
    return result;
  }

  try {
    // Создаем условия для всех шагов
    const conditions: Prisma.ProductWhereInput[] = [];

    for (const baseStep of baseSteps) {
      const stepCondition: Prisma.ProductWhereInput = {
        published: true,
        brand: {
          isActive: true,
        },
      };

      if (baseStep === 'spf') {
        stepCondition.OR = [
          { step: 'spf' },
          { category: 'spf' },
        ];
      } else {
        stepCondition.step = baseStep;

        if (profileClassification.skinType) {
          stepCondition.AND = [
            {
              OR: [
                { skinTypes: { has: profileClassification.skinType } },
                { skinTypes: { isEmpty: true } },
              ],
            },
          ];
        }
      }

      conditions.push(stepCondition);
    }

    // Выполняем batch запрос
    const products = await prisma.product.findMany({
      where: {
        OR: conditions,
      },
      include: {
        brand: true,
      },
      orderBy: [
        { isHero: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Группируем продукты по baseStep
    for (const product of products) {
      const productStep = product.step || product.category || '';
      
      // Находим соответствующий baseStep
      for (const baseStep of baseSteps) {
        if (
          baseStep === 'spf' && (productStep.toLowerCase().includes('spf') || product.category === 'spf')
        ) {
          if (!result.has(baseStep)) {
            result.set(baseStep, product as ProductWithBrand);
          }
          break;
        } else if (productStep.startsWith(baseStep) || product.step === baseStep) {
          if (!result.has(baseStep)) {
            result.set(baseStep, product as ProductWithBrand);
          }
          break;
        }
      }
    }

    logger.info('Fallback products found', {
      requested: baseSteps.length,
      found: result.size,
      baseSteps: Array.from(result.keys()),
    });

    return result;
  } catch (error) {
    logger.error('Error finding fallback products batch', {
      error,
      baseSteps,
    });
    return result;
  }
}

/**
 * Обеспечивает наличие продукта для шага
 */
export async function ensureProductForStep(
  stepCategory: StepCategory,
  profileClassification: ProfileClassification,
  existingProducts: ProductWithBrand[]
): Promise<ProductWithBrand | null> {
  // Если продукт уже есть - возвращаем его
  if (existingProducts.length >= MIN_PRODUCTS_FOR_STEP) {
    return existingProducts[0];
  }

  // Ищем fallback
  const baseStep = getBaseStepFromStepCategory(stepCategory);
  const fallback = await findFallbackProduct(baseStep, profileClassification);

  if (fallback) {
    logger.info('Fallback product assigned', {
      stepCategory,
      baseStep,
      productId: fallback.id,
      productName: fallback.name,
    });
  }

  return fallback;
}

/**
 * Обеспечивает наличие продуктов для обязательных шагов
 */
export async function ensureRequiredProducts(
  requiredSteps: StepCategory[],
  profileClassification: ProfileClassification,
  existingProductsByStep: Map<StepCategory, ProductWithBrand[]>
): Promise<Map<StepCategory, ProductWithBrand[]>> {
  const result = new Map(existingProductsByStep);

  // Определяем, какие шаги нужны
  const missingSteps = requiredSteps.filter((step) => {
    const existing = result.get(step);
    return !existing || existing.length < MIN_PRODUCTS_FOR_STEP;
  });

  if (missingSteps.length === 0) {
    return result;
  }

  // Группируем по baseStep для batch запроса
  const baseStepsMap = new Map<string, Set<StepCategory>>();
  
  for (const stepCategory of missingSteps) {
    const baseStep = getBaseStepFromStepCategory(stepCategory);
    if (!baseStepsMap.has(baseStep)) {
      baseStepsMap.set(baseStep, new Set());
    }
    baseStepsMap.get(baseStep)!.add(stepCategory);
  }

  // Выполняем batch запрос
  const baseSteps = Array.from(baseStepsMap.keys());
  const fallbackProducts = await findFallbackProductsBatch(
    baseSteps,
    profileClassification
  );

  // Присваиваем fallback продукты шагам
  for (const [baseStep, stepCategories] of baseStepsMap.entries()) {
    const fallbackProduct = fallbackProducts.get(baseStep);
    
    if (!fallbackProduct) {
      logger.warn('Required product not found', {
        baseStep,
        stepCategories: Array.from(stepCategories),
      });
      continue;
    }

    // Присваиваем продукт всем категориям шага
    for (const stepCategory of stepCategories) {
      const existing = result.get(stepCategory) || [];
      if (existing.length === 0) {
        result.set(stepCategory, [fallbackProduct]);
      }
    }
  }

  return result;
}

