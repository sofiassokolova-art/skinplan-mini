// lib/product-selection.ts
// Общая логика подбора продуктов для правил рекомендаций

import { prisma } from '@/lib/db';
import { normalizeIngredient } from './ingredient-normalizer';
import { filterProductsBasic, type ProductFilterContext } from './unified-product-filter';
import type { ProfileClassification } from './plan-generation-helpers';

export interface RuleStep {
  category?: string[];
  concerns?: string[];
  skin_types?: string[];
  is_non_comedogenic?: boolean;
  is_fragrance_free?: boolean;
  budget?: 'бюджетный' | 'средний' | 'премиум' | 'любой';
  is_natural?: boolean;
  active_ingredients?: string[];
  max_items?: number;
}

/**
 * ИСПРАВЛЕНО: Получает продукты по фильтрам шага правила
 * Улучшенная версия с поддержкой частичного совпадения step и нормализацией skinTypes
 * Теперь применяет unified-product-filter для консистентности с планом
 */
export async function getProductsForStep(
  step: RuleStep, 
  userPriceSegment?: string | null,
  profileClassification?: ProfileClassification
) {
  const where: any = {
    published: true,
    brand: {
      isActive: true,
    },
  };

  // SPF универсален для всех типов кожи - не фильтруем по типу кожи
  const isSPF = step.category?.includes('spf') || step.category?.some((c: string) => c.toLowerCase().includes('spf'));
  
  // ИСПРАВЛЕНО: Строим условия для category/step - сначала строгое совпадение, потом fallback
  if (step.category && step.category.length > 0) {
    const strictCategoryConditions: any[] = []; // Строгие совпадения (приоритет)
    const fallbackCategoryConditions: any[] = []; // Fallback (если мало результатов)
    
    // Маппинг категорий из правил в категории БД
    // ВАЖНО: Этот маппинг должен соответствовать категориям в БД и stepName в правилах
    const categoryMapping: Record<string, string[]> = {
      'cream': ['moisturizer'], // В правилах используется "cream", в БД - "moisturizer"
      'moisturizer': ['moisturizer'],
      'cleanser': ['cleanser'],
      'cleanser_oil': ['cleanser'], // Гидрофильное масло ищется как cleanser с ключевыми словами
      'serum': ['serum'],
      'toner': ['toner'],
      'treatment': ['treatment'], // treatment в правилах -> treatment в БД (category)
      'spf': ['spf'],
      'mask': ['mask'], // mask в правилах -> mask в БД (category, если есть)
    };
    
    for (const cat of step.category) {
      const normalizedCats = categoryMapping[cat] || [cat];
      const isOilCleanser = cat === 'cleanser_oil' || cat.includes('oil');
      
      for (const normalizedCat of normalizedCats) {
        if (isOilCleanser) {
          // Для гидрофильного масла ищем по ключевым словам: oil, масло, гидрофильное
          strictCategoryConditions.push({ 
            AND: [
              { category: normalizedCat },
              { OR: [
                { name: { contains: 'oil', mode: 'insensitive' } },
                { name: { contains: 'масл', mode: 'insensitive' } },
                { name: { contains: 'гидрофильн', mode: 'insensitive' } },
                { step: { contains: 'oil', mode: 'insensitive' } },
                { description: { contains: 'масло', mode: 'insensitive' } },
                { descriptionUser: { contains: 'масло', mode: 'insensitive' } },
              ]}
            ]
          });
          // Также ищем просто по category/step для продуктов, которые уже помечены как oil
          strictCategoryConditions.push({ category: normalizedCat, step: { contains: 'oil', mode: 'insensitive' } });
        } else {
          // ИСПРАВЛЕНО: Сначала строгое совпадение по category (приоритет)
          strictCategoryConditions.push({ category: normalizedCat });
          // Строгое совпадение по step (на случай, если в БД step = category)
          strictCategoryConditions.push({ step: normalizedCat });
          // Fallback: частичное совпадение по step (например, 'serum' найдет 'serum_hydrating')
          fallbackCategoryConditions.push({ step: { startsWith: normalizedCat } });
        }
      }
    }
    
    // ИСПРАВЛЕНО: Используем строгие условия сначала, fallback только если мало результатов
    where.OR = strictCategoryConditions;
    // Fallback будет использован позже, если продуктов недостаточно
  }

  // Нормализуем skinTypes: combo -> combination_dry, combination_oily, или просто combo
  if (step.skin_types && step.skin_types.length > 0 && !isSPF) {
    const normalizedSkinTypes: string[] = [];
    
    for (const skinType of step.skin_types) {
      normalizedSkinTypes.push(skinType);
      // Если ищем 'combo', также ищем варианты
      if (skinType === 'combo') {
        normalizedSkinTypes.push('combination_dry');
        normalizedSkinTypes.push('combination_oily');
      }
      // Если ищем 'dry', также ищем 'combination_dry'
      if (skinType === 'dry') {
        normalizedSkinTypes.push('combination_dry');
      }
      // Если ищем 'oily', также ищем 'combination_oily'
      if (skinType === 'oily') {
        normalizedSkinTypes.push('combination_oily');
      }
    }
    
    where.skinTypes = { hasSome: normalizedSkinTypes };
  }

  // Concerns: если указаны, ищем по ним, но не блокируем, если не найдено
  // (так как многие продукты могут не иметь concerns)
  // ВАЖНО: concerns добавляем в AND, а не в OR, чтобы не нарушить логику поиска по category/step
  if (step.concerns && step.concerns.length > 0) {
    // Используем OR внутри AND для concerns, чтобы не блокировать продукты без concerns
    const concernsCondition = {
      OR: [
        { concerns: { hasSome: step.concerns } },
        { concerns: { isEmpty: true } }, // Также берем продукты без concerns
      ],
    };
    
    // Если уже есть AND, добавляем к нему, иначе создаем новый
    if (where.AND) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, concernsCondition] : [where.AND, concernsCondition];
    } else {
      where.AND = [concernsCondition];
    }
  }

  if (step.is_non_comedogenic === true) {
    where.isNonComedogenic = true;
  }

  if (step.is_fragrance_free === true) {
    where.isFragranceFree = true;
  }

  // Фильтрация по бюджету (priceSegment)
  const ruleBudget = step.budget;
  if (ruleBudget && ruleBudget !== 'любой') {
    // Маппинг бюджетных сегментов: бюджетный -> mass, средний -> mid, премиум -> premium
    const budgetMapping: Record<string, string> = {
      'бюджетный': 'mass',
      'средний': 'mid',
      'премиум': 'premium',
    };
    
    const priceSegment = budgetMapping[ruleBudget];
    if (priceSegment) {
      where.priceSegment = priceSegment;
    }
  } else if (userPriceSegment) {
    // Если в правиле не указан бюджет, используем бюджет пользователя
    where.priceSegment = userPriceSegment;
  }

  // Фильтрация по натуральности (если указано)
  // ПРИМЕЧАНИЕ: В текущей схеме БД нет поля isNatural/isOrganic
  // Можно добавить проверку по composition на наличие натуральных ингредиентов
  // Пока оставляем как есть, так как в схеме нет поля isNatural
  if (step.is_natural === true) {
    // Можно добавить проверку по composition, если нужно
    // Например: where.composition = { contains: 'натуральный' } или проверка на органические ингредиенты
  }

  // Фильтрация по активным ингредиентам (если указано в правиле)
  // Это используется для специальных правил, например, для мелазмы нужна транексамовая кислота
  // ВАЖНО: Если продуктов с указанными ингредиентами нет, не блокируем поиск - используем fallback
  if (step.active_ingredients && step.active_ingredients.length > 0) {
    // Создаем список всех нормализованных вариантов ингредиентов
    const normalizedIngredients: string[] = [];
    for (const ingredient of step.active_ingredients) {
      const variants = normalizeIngredient(ingredient);
      normalizedIngredients.push(...variants);
    }
    
    // Ищем продукты, которые содержат указанные активные ингредиенты
    // Используем частичное совпадение через фильтрацию в памяти
    // (Prisma не поддерживает частичное совпадение для массивов)
    const activeIngredientsCondition = {
      OR: [
        // Продукты с указанными ингредиентами (точное совпадение)
        ...normalizedIngredients.map(ingredient => ({
          activeIngredients: { has: ingredient },
        })),
        // Также берем продукты без activeIngredients (fallback)
        { activeIngredients: { isEmpty: true } },
      ],
    };
    
    // Добавляем в AND условия
    if (where.AND) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, activeIngredientsCondition] : [where.AND, activeIngredientsCondition];
    } else {
      where.AND = [activeIngredientsCondition];
    }
  }

  // Первая попытка: точный поиск
  let products = await prisma.product.findMany({
    where,
    include: {
      brand: true,
    },
    take: (step.max_items || 3) * 3, // Берем больше для фильтрации
  });

  // Дополнительная фильтрация по ингредиентам с частичным совпадением
  if (step.active_ingredients && step.active_ingredients.length > 0 && products.length > 0) {
    const { normalizeIngredientSimple } = await import('./ingredient-normalizer');
    
    const normalizedRuleIngredients = step.active_ingredients.map(normalizeIngredientSimple);
    
    // ИСПРАВЛЕНО: В strict режиме продукты без activeIngredients не пропускаются автоматически
    // Если правило требует active_ingredients, отсутствие разметки - минус (но не блокируем полностью)
    products = products.filter(product => {
      // Если у продукта нет activeIngredients - пропускаем только в strict режиме
      // Для обычного режима - пропускаем (fallback для продуктов без разметки)
      if (product.activeIngredients.length === 0) {
        // ИСПРАВЛЕНО: В strict режиме (когда правило явно требует ингредиенты) - не пропускаем
        // Для обычного режима - пропускаем как fallback
        // Пока используем обычный режим (можно добавить параметр strict позже)
        return true;
      }
      
      return product.activeIngredients.some(productIng => {
        const normalizedProductIng = productIng.toLowerCase().trim();
        return normalizedRuleIngredients.some((ruleIng: string) => {
          if (normalizedProductIng === ruleIng) return true;
          if (normalizedProductIng.includes(ruleIng) || ruleIng.includes(normalizedProductIng)) return true;
          const productIngNoUnderscore = normalizedProductIng.replace(/_/g, '');
          const ruleIngNoUnderscore = ruleIng.replace(/_/g, '');
          if (productIngNoUnderscore === ruleIngNoUnderscore) return true;
          if (productIngNoUnderscore.includes(ruleIngNoUnderscore) || ruleIngNoUnderscore.includes(productIngNoUnderscore)) return true;
          return false;
        });
      });
    });
  }

  // ИСПРАВЛЕНО: Если не нашли достаточно продуктов, используем fallback условия
  if (products.length < (step.max_items || 3) && step.category && step.category.length > 0) {
    const fallbackWhere: any = {
      published: true,
      brand: {
        isActive: true,
      },
    };

    // ИСПРАВЛЕНО: Используем fallback условия (частичное совпадение по category/step)
    const fallbackConditions: any[] = [];
    const categoryMapping: Record<string, string[]> = {
      'cream': ['moisturizer'],
      'moisturizer': ['moisturizer'],
      'cleanser': ['cleanser'],
      'cleanser_oil': ['cleanser'],
      'serum': ['serum'],
      'toner': ['toner'],
      'treatment': ['treatment'],
      'spf': ['spf'],
      'mask': ['mask'],
    };
    
    for (const cat of step.category) {
      const normalizedCats = categoryMapping[cat] || [cat];
      for (const normalizedCat of normalizedCats) {
        // Fallback: частичное совпадение
        fallbackConditions.push({ category: { contains: normalizedCat } });
        fallbackConditions.push({ step: { contains: normalizedCat } });
      }
    }
    fallbackWhere.OR = fallbackConditions;

    // Убираем фильтры по skinTypes и concerns для fallback
    const fallbackProducts = await prisma.product.findMany({
      where: fallbackWhere,
      include: {
        brand: true,
      },
      take: (step.max_items || 3) * 2,
    });

    // Объединяем результаты, убирая дубликаты
    const existingIds = new Set(products.map(p => p.id));
    const newProducts = fallbackProducts.filter(p => !existingIds.has(p.id));
    products = [...products, ...newProducts];
  }
  
  // ИСПРАВЛЕНО: Применяем unified-product-filter для консистентности с планом
  // Это гарантирует, что рекомендации и план используют одинаковую логику фильтрации
  // Включая ingredient-compatibility как центральный гейт
  if (profileClassification && products.length > 0) {
    const filteredResults = filterProductsBasic(products as any, profileClassification, 'soft');
    products = filteredResults as any[];
    
    // ИСПРАВЛЕНО: Дополнительная проверка совместимости ингредиентов для рекомендаций
    // Даже без протокола проверяем базовую совместимость между продуктами
    // Используем ingredient-compatibility как центральный гейт
    if (products.length > 1) {
      const { checkProductCompatibility } = await import('./ingredient-compatibility');
      const compatibleProducts: typeof products = [];
      
      for (const product of products) {
        // Проверяем совместимость с уже выбранными продуктами
        let isCompatible = true;
        for (const selectedProduct of compatibleProducts) {
          const conflict = checkProductCompatibility(
            { activeIngredients: product.activeIngredients || [], composition: undefined },
            { activeIngredients: selectedProduct.activeIngredients || [], composition: undefined }
          );
          
          // ИСПРАВЛЕНО: Если конфликт high severity - пропускаем продукт
          // Для medium/low severity - оставляем (может быть решено через separate_time)
          if (conflict && conflict.severity === 'high') {
            isCompatible = false;
            break;
          }
        }
        
        if (isCompatible) {
          compatibleProducts.push(product);
        }
      }
      
      // Используем совместимые продукты, если их достаточно
      if (compatibleProducts.length >= (step.max_items || 3) || compatibleProducts.length > 0) {
        products = compatibleProducts;
      }
    }
  }

  // Сортируем в памяти по приоритету и isHero
  const sorted = products.sort((a: any, b: any) => {
    if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
  return sorted.slice(0, step.max_items || 3);
}

