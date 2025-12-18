// lib/plan-generation-helpers.ts
// Вспомогательные функции для генерации плана ухода

import type { StepCategory } from './step-category-rules';
import { prisma } from '@/lib/db';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

export interface ProfileClassification {
  skinType?: string | null;
  concerns?: string[];
  diagnoses?: string[];
  hasPregnancy?: boolean;
  pregnant?: boolean;
  mainGoals?: string[];
  secondaryGoals?: string[];
  sensitivityLevel?: string | null;
  routineComplexity?: string;
  budget?: string;
  focus?: string | string[]; // Может быть строкой или массивом
  stepsPreference?: string | string[]; // Может быть строкой или массивом
  exclude?: string[];
  allergies?: string[];
  seasonality?: string | null;
  carePreference?: string;
  ageGroup?: string | null;
}

/**
 * Проверяет и заменяет продукты с неактивными брендами
 */
export async function replaceInactiveBrandProducts(
  products: Array<{
    id: number;
    name: string;
    brand: { id: number; name: string; isActive: boolean };
    step: string | null;
    category: string | null;
  }>,
  profileClassification: ProfileClassification,
  hasRecentProfileUpdate: boolean
): Promise<Array<typeof products[0]>> {
  if (!hasRecentProfileUpdate) {
    logger.info('User has not retaken questionnaire recently, keeping existing products even if brand is inactive');
    return products;
  }

  const result: typeof products = [];
  const replacements: Array<{ oldId: number; newId: number; name: string }> = [];

  for (const product of products) {
    const productBrand = product.brand;
    
    if (!productBrand.isActive) {
      logger.warn('Product has inactive brand, searching for replacement', {
        productId: product.id,
        productName: product.name,
        brandName: productBrand.name,
      });

      // Ищем замену из активных брендов
      const step = product.step || product.category || '';
      const replacement = await prisma.product.findFirst({
        where: {
          published: true,
          AND: [
            { id: { not: product.id } },
            {
              OR: [
                { step: step },
                { category: step },
                { step: { startsWith: step.split('_')[0] } },
              ],
            },
            { brand: { isActive: true } },
            ...(profileClassification.skinType
              ? [
                  {
                    OR: [
                      { skinTypes: { has: profileClassification.skinType } },
                      { skinTypes: { isEmpty: true } },
                    ],
                  },
                ]
              : []),
          ],
        },
        include: { brand: true },
        orderBy: [{ isHero: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      });

      if (replacement) {
        result.push(replacement as typeof products[0]);
        replacements.push({
          oldId: product.id,
          newId: replacement.id,
          name: replacement.name,
        });
        logger.info('Product replaced due to inactive brand', {
          oldProductId: product.id,
          newProductId: replacement.id,
          newProductName: replacement.name,
        });
      } else {
        // Если не нашли точную замену, берем любой активный продукт для этого шага
        const anyReplacement = await prisma.product.findFirst({
          where: {
            published: true,
            AND: [
              { id: { not: product.id } },
              { brand: { isActive: true } },
              {
                OR: [
                  { step: step },
                  { category: step },
                ],
              },
            ],
          },
          include: { brand: true },
          orderBy: [{ createdAt: 'desc' }],
        });

        if (anyReplacement) {
          result.push(anyReplacement as typeof products[0]);
          replacements.push({
            oldId: product.id,
            newId: anyReplacement.id,
            name: anyReplacement.name,
          });
          logger.info('Product replaced with any available product', {
            oldProductId: product.id,
            newProductId: anyReplacement.id,
            newProductName: anyReplacement.name,
          });
        } else {
          // Если совсем не нашли замену, оставляем оригинальный продукт
          result.push(product);
          logger.warn('Could not find replacement for product with inactive brand, keeping original', {
            productId: product.id,
            productName: product.name,
          });
        }
      }
    } else {
      result.push(product);
    }
  }

  if (replacements.length > 0) {
    logger.info('Products replaced due to inactive brands', {
      replacementsCount: replacements.length,
      replacements: replacements.map(r => `${r.oldId} -> ${r.newId} (${r.name})`),
    });
  }

  return result;
}

/**
 * Регистрирует продукт для шага в Map
 */
export function registerProductForStepMap(
  stepCategory: StepCategory,
  product: { id: number; name: string; step?: string | null; category?: string | null },
  productsByStepMap: Map<StepCategory, Array<typeof product>>
): void {
  if (!productsByStepMap.has(stepCategory)) {
    productsByStepMap.set(stepCategory, []);
  }
  const existing = productsByStepMap.get(stepCategory)!;
  if (!existing.some(p => p.id === product.id)) {
    existing.push(product);
  }
}

