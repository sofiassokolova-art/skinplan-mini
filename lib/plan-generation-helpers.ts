// lib/plan-generation-helpers.ts
// Вспомогательные функции для генерации плана ухода

import type { StepCategory } from './step-category-rules';
import { prisma } from '@/lib/db';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';
import { mapStepToStepCategory } from './step-matching';
import { normalizeSkinTypeForRules } from './skin-type-normalizer';
import { filterProductsWithReasons, type ProductFilterContext } from './unified-product-filter';
import { determineProtocol } from './dermatology-protocols';
import type { ProductWithBrand } from './product-fallback';

export interface ProfileClassification {
  skinType?: string | null;
  concerns?: string[];
  diagnoses?: string[];
  rosaceaRisk?: 'low' | 'medium' | 'high' | 'critical' | string | null;
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
 * ИСПРАВЛЕНО (P0, P1): Проверяет и заменяет продукты с неактивными брендами
 * 
 * Изменения:
 * - Использует mapStepToStepCategory для определения канонического StepCategory
 * - Использует filterProductsWithReasons для дерматологической фильтрации
 * - Нормализует skinType (combo -> combination_dry/combination_oily)
 * - Батчит запросы вместо N+1
 * - Убрал "anyReplacement" - возвращает оригинал с warning если не нашли валидную замену
 * 
 * @param products - Продукты для проверки
 * @param profileClassification - Классификация профиля
 * @param hasRecentProfileUpdate - Была ли недавно обновлена анкета
 * @param context - Дополнительный контекст для фильтрации (timeOfDay, day, week, alreadySelected)
 */
export async function replaceInactiveBrandProducts(
  products: Array<{
    id: number;
    name: string;
    brand: { id: number; name: string; isActive: boolean };
    step: string | null;
    category: string | null;
    skinTypes?: string[] | null;
    activeIngredients?: string[] | null;
    priceSegment?: string | null;
    isHero?: boolean | null;
    priority?: number | null;
  }>,
  profileClassification: ProfileClassification,
  hasRecentProfileUpdate: boolean,
  context?: {
    timeOfDay?: 'morning' | 'evening';
    day?: number;
    week?: number;
    alreadySelected?: ProductWithBrand[];
  }
): Promise<Array<typeof products[0] & { replacementWarning?: string }>> {
  if (!hasRecentProfileUpdate) {
    logger.info('User has not retaken questionnaire recently, keeping existing products even if brand is inactive');
    return products;
  }

  // ИСПРАВЛЕНО (P0): Определяем StepCategory для каждого продукта
  const productsWithStepCategories = products.map(product => {
    const stepCategories = mapStepToStepCategory(
      product.step,
      product.category,
      profileClassification.skinType || null
    );
    return { product, stepCategories };
  });

  // ИСПРАВЛЕНО (P1): Батчим запросы - собираем все нужные StepCategory
  const allStepCategories = new Set<StepCategory>();
  productsWithStepCategories.forEach(({ stepCategories }) => {
    stepCategories.forEach(sc => allStepCategories.add(sc));
  });

  // ИСПРАВЛЕНО (P0): Нормализуем skinType для запросов
  const normalizedSkinType = normalizeSkinTypeForRules(
    profileClassification.skinType,
    { userId: undefined }
  );
  const normalizedSkinTypes = normalizedSkinType
    ? [normalizedSkinType, ...(normalizedSkinType === 'combination_dry' ? ['dry'] : []), ...(normalizedSkinType === 'combination_oily' ? ['oily'] : [])]
    : [];

  // ИСПРАВЛЕНО (P1): Один запрос для всех кандидатов
  const candidateProducts = await prisma.product.findMany({
    where: {
      published: true,
      brand: { isActive: true },
      AND: [
        // ИСПРАВЛЕНО (P0): Матчим по StepCategory через category (строго, без startsWith)
        {
          OR: Array.from(allStepCategories).map(stepCategory => ({
            category: stepCategory,
          })),
        },
        // ИСПРАВЛЕНО (P0): Нормализованный skinType
        ...(normalizedSkinTypes.length > 0
          ? [
              {
                OR: [
                  { skinTypes: { hasSome: normalizedSkinTypes } },
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

      // ИСПРАВЛЕНО (P0): Определяем протокол для фильтрации
      const protocol = determineProtocol({
        diagnoses: profileClassification.diagnoses || [],
        concerns: profileClassification.concerns || [],
        skinType: profileClassification.skinType || undefined,
        sensitivityLevel: profileClassification.sensitivityLevel || undefined,
      });

  const result: Array<typeof products[0] & { replacementWarning?: string }> = [];
  const replacements: Array<{ oldId: number; newId: number; name: string; reason?: string }> = [];

  for (const { product, stepCategories } of productsWithStepCategories) {
    const productBrand = product.brand;

    if (!productBrand.isActive) {
      logger.warn('Product has inactive brand, searching for replacement', {
        productId: product.id,
        productName: product.name,
        brandName: productBrand.name,
        stepCategories,
      });

      // ИСПРАВЛЕНО (P0): Ищем замену только среди кандидатов с тем же StepCategory
      const candidatesForStep = candidateProducts.filter(candidate => {
        // Матчим по StepCategory
        return stepCategories.some(sc => candidate.category === sc);
      });

      if (candidatesForStep.length === 0) {
        // ИСПРАВЛЕНО (P0): Если нет кандидатов - возвращаем оригинал с warning
        result.push({
          ...product,
          replacementWarning: `Не удалось найти замену для продукта с неактивным брендом. Рекомендуется заменить вручную.`,
        });
        logger.warn('Could not find replacement candidates for product with inactive brand', {
          productId: product.id,
          productName: product.name,
          stepCategories,
        });
        continue;
      }

      // ИСПРАВЛЕНО (P0): Преобразуем кандидатов в ProductWithBrand
      const candidatesAsProductWithBrand: ProductWithBrand[] = candidatesForStep.map(c => ({
        id: c.id,
        name: c.name,
        brand: {
          id: c.brand.id,
          name: c.brand.name,
          isActive: c.brand.isActive,
        },
        step: c.step || '',
        category: c.category,
        price: (c as any).price || null,
        imageUrl: (c as any).imageUrl || null,
        isHero: c.isHero || false,
        priority: c.priority || 0,
        skinTypes: (c.skinTypes as string[]) || [],
        published: c.published,
        activeIngredients: (c.activeIngredients as string[]) || undefined,
      }));

      // ИСПРАВЛЕНО (P0): Фильтруем через unified-product-filter для каждого StepCategory
      let bestReplacement: typeof products[0] | null = null;
      let bestReplacementReason: string | undefined;

      for (const stepCategory of stepCategories) {
        const filterContext: ProductFilterContext = {
          profileClassification,
          protocol,
          stepCategory,
          timeOfDay: context?.timeOfDay || 'morning',
          day: context?.day || 1,
          week: context?.week || 1,
          alreadySelected: context?.alreadySelected || [],
          strictness: 'hard', // ИСПРАВЛЕНО: Используем hard strictness для замены
        };

        const filtered = await filterProductsWithReasons(candidatesAsProductWithBrand, filterContext);
        const allowed = filtered.filter(r => r.allowed);

        if (allowed.length > 0) {
          // Берем первый валидный продукт (уже отсортирован по isHero/priority/createdAt)
          const replacement = allowed[0].product;
          bestReplacement = {
            id: replacement.id,
            name: replacement.name,
            brand: {
              id: replacement.brand.id,
              name: replacement.brand.name,
              isActive: replacement.brand.isActive,
            },
            step: replacement.step,
            category: replacement.category,
            skinTypes: replacement.skinTypes,
            activeIngredients: replacement.activeIngredients,
            isHero: replacement.isHero,
            priority: replacement.priority,
          } as typeof products[0];
          bestReplacementReason = `StepCategory: ${stepCategory}`;
          break; // Нашли валидную замену
        } else {
          // Логируем причины отказа для дебага
          logger.debug('No valid replacement found for stepCategory', {
            stepCategory,
            productId: product.id,
            reasons: filtered.map((f: { reason?: string }) => f.reason).filter(Boolean),
          });
        }
      }

      if (bestReplacement) {
        result.push(bestReplacement);
        replacements.push({
          oldId: product.id,
          newId: bestReplacement.id,
          name: bestReplacement.name,
          reason: bestReplacementReason,
        });
        logger.info('Product replaced due to inactive brand', {
          oldProductId: product.id,
          newProductId: bestReplacement.id,
          newProductName: bestReplacement.name,
          reason: bestReplacementReason,
        });
      } else {
        // ИСПРАВЛЕНО (P0): Если не нашли валидную замену - возвращаем оригинал с warning
        result.push({
          ...product,
          replacementWarning: `Не удалось найти валидную замену (проверка протокола/совместимости не пройдена). Рекомендуется заменить вручную.`,
        });
        logger.warn('Could not find valid replacement for product with inactive brand (filtered out)', {
          productId: product.id,
          productName: product.name,
          stepCategories,
        });
      }
    } else {
      result.push(product);
    }
  }

  if (replacements.length > 0) {
    logger.info('Products replaced due to inactive brands', {
      replacementsCount: replacements.length,
      replacements: replacements.map(r => `${r.oldId} -> ${r.newId} (${r.name})${r.reason ? ` [${r.reason}]` : ''}`),
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

