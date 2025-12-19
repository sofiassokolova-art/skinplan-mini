// scripts/fill-product-fields.ts
// Скрипт для заполнения пустых полей продуктов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг шагов на приоритеты (чем выше число, тем выше приоритет)
const STEP_PRIORITIES: Record<string, number> = {
  // Очищение - базовый шаг, высокий приоритет
  'cleanser_gentle': 50,
  'cleanser_balancing': 50,
  'cleanser_deep': 45,
  'cleanser': 50,
  
  // Тонер - важный шаг
  'toner_soothing': 40,
  'toner_hydrating': 40,
  'toner': 40,
  
  // Сыворотки - важные, но разные приоритеты
  'serum_vitc': 60, // Витамин C - очень важный
  'serum_niacinamide': 55,
  'serum_hydrating': 50,
  'serum_anti_redness': 45,
  'serum_brightening_soft': 45,
  'serum': 50,
  
  // Лечение - высокий приоритет для проблемной кожи
  'treatment_acne_azelaic': 70,
  'treatment_acne_bpo': 70,
  'treatment_acne_local': 65,
  'treatment_pigmentation': 60,
  'treatment_antiage': 55,
  'treatment_exfoliant_mild': 50,
  'treatment_exfoliant_strong': 45,
  'treatment': 55,
  
  // Увлажнение - базовый шаг
  'moisturizer_rich': 50,
  'moisturizer_light': 50,
  'moisturizer_balancing': 50,
  'moisturizer_soothing': 50,
  'moisturizer_barrier': 55,
  'moisturizer': 50,
  
  // SPF - критически важный
  'spf_50_face': 80,
  'spf_50_sensitive': 80,
  'spf_50_oily': 80,
  'spf': 80,
  
  // Маски - дополнительный уход
  'mask_sleeping': 35,
  'mask_soothing': 35,
  'mask_hydrating': 35,
  'mask_clay': 30,
  'mask': 35,
  
  // Специальные средства
  'eye_cream_basic': 40,
  'balm_barrier_repair': 45,
  'spot_treatment': 55,
  'lip_care': 30,
};

// Определение avoidIf на основе активных ингредиентов
function getAvoidIf(activeIngredients: string[]): string[] {
  const avoid: string[] = [];
  const ingredientsLower = activeIngredients.map(ing => ing.toLowerCase());
  
  // Retinol и ретиноиды - противопоказаны при беременности
  if (ingredientsLower.some(ing => 
    ing.includes('retinol') || 
    ing.includes('ретинол') ||
    ing.includes('retinoid') ||
    ing.includes('ретиноид') ||
    ing.includes('tretinoin') ||
    ing.includes('adapalene') ||
    ing.includes('tazarotene')
  )) {
    avoid.push('pregnant');
    avoid.push('breastfeeding');
  }
  
  // AHA/BHA в высоких концентрациях
  if (ingredientsLower.some(ing => 
    (ing.includes('aha') || ing.includes('bha') || ing.includes('салициловая') || ing.includes('гликолевая')) &&
    (ing.includes('10%') || ing.includes('15%') || ing.includes('20%') || ing.includes('30%'))
  )) {
    avoid.push('pregnant');
  }
  
  // Бензоил пероксид - противопоказан при беременности
  if (ingredientsLower.some(ing => 
    ing.includes('benzoyl') || ing.includes('бензоил')
  )) {
    avoid.push('pregnant');
    avoid.push('breastfeeding');
  }
  
  return [...new Set(avoid)]; // Убираем дубликаты
}

// Генерация описания на основе категории и активных ингредиентов
function generateDescription(
  name: string,
  step: string,
  category: string,
  activeIngredients: string[],
  concerns: string[]
): { description: string; descriptionUser: string } {
  const stepName = step || category;
  
  // Краткое описание для пользователя (descriptionUser)
  let userDesc = '';
  
  if (stepName.includes('cleanser')) {
    userDesc = 'Очищающее средство для ежедневного ухода';
  } else if (stepName.includes('toner')) {
    userDesc = 'Тоник для подготовки кожи к дальнейшему уходу';
  } else if (stepName.includes('serum')) {
    if (stepName.includes('vitc') || activeIngredients.some(ing => ing.toLowerCase().includes('vitamin c') || ing.toLowerCase().includes('витамин c'))) {
      userDesc = 'Сыворотка с витамином C для осветления и защиты от свободных радикалов';
    } else if (stepName.includes('niacinamide') || activeIngredients.some(ing => ing.toLowerCase().includes('niacinamide') || ing.toLowerCase().includes('ниацинамид'))) {
      userDesc = 'Сыворотка с ниацинамидом для выравнивания тона и укрепления барьера';
    } else if (stepName.includes('hydrating')) {
      userDesc = 'Увлажняющая сыворотка для глубокого питания кожи';
    } else {
      userDesc = 'Сыворотка для целенаправленного ухода';
    }
  } else if (stepName.includes('treatment')) {
    if (stepName.includes('acne')) {
      userDesc = 'Средство для лечения акне и воспалений';
    } else if (stepName.includes('pigmentation')) {
      userDesc = 'Средство для выравнивания тона и борьбы с пигментацией';
    } else if (stepName.includes('antiage')) {
      userDesc = 'Антивозрастное средство для борьбы с признаками старения';
    } else if (stepName.includes('exfoliant')) {
      userDesc = 'Отшелушивающее средство для обновления кожи';
    } else {
      userDesc = 'Лечебное средство для целенаправленного ухода';
    }
  } else if (stepName.includes('moisturizer')) {
    if (stepName.includes('rich')) {
      userDesc = 'Питательный крем для сухой и обезвоженной кожи';
    } else if (stepName.includes('light')) {
      userDesc = 'Легкий крем для жирной и комбинированной кожи';
    } else if (stepName.includes('barrier')) {
      userDesc = 'Восстанавливающий крем для укрепления защитного барьера';
    } else {
      userDesc = 'Увлажняющий крем для ежедневного ухода';
    }
  } else if (stepName.includes('spf')) {
    userDesc = 'Солнцезащитное средство для защиты от UV-излучения';
  } else if (stepName.includes('mask')) {
    if (stepName.includes('sleeping')) {
      userDesc = 'Ночная маска для интенсивного ухода во время сна';
    } else if (stepName.includes('soothing')) {
      userDesc = 'Успокаивающая маска для чувствительной кожи';
    } else {
      userDesc = 'Маска для дополнительного ухода';
    }
  } else if (stepName.includes('eye')) {
    userDesc = 'Крем для ухода за областью вокруг глаз';
  } else {
    userDesc = 'Средство для ухода за кожей';
  }
  
  // Полное описание (description)
  let fullDesc = userDesc;
  
  if (activeIngredients.length > 0) {
    const mainIngredients = activeIngredients.slice(0, 3).join(', ');
    fullDesc += `. Активные ингредиенты: ${mainIngredients}`;
  }
  
  if (concerns.length > 0) {
    const concernsMap: Record<string, string> = {
      'acne': 'акне',
      'pigmentation': 'пигментация',
      'barrier': 'поврежденный барьер',
      'dehydration': 'обезвоживание',
      'wrinkles': 'морщины',
      'pores': 'расширенные поры',
      'redness': 'покраснения',
      'rosacea': 'розацеа',
    };
    const concernsRu = concerns
      .slice(0, 3)
      .map(c => concernsMap[c] || c)
      .join(', ');
    fullDesc += `. Подходит для: ${concernsRu}`;
  }
  
  return {
    description: fullDesc,
    descriptionUser: userDesc,
  };
}

// Определение isHero на основе приоритета и категории
function getIsHero(step: string, priority: number, category: string): boolean {
  // SPF всегда hero
  if (step?.includes('spf') || category?.includes('spf')) {
    return true;
  }
  
  // Высокоприоритетные средства - hero
  if (priority >= 60) {
    return true;
  }
  
  // Лечебные средства для акне - hero
  if (step?.includes('treatment_acne')) {
    return true;
  }
  
  return false;
}

async function fillProductFields() {
  console.log('🚀 Начинаем заполнение полей продуктов...\n');

  const allProducts = await prisma.product.findMany({
    where: {
      published: true,
    },
    include: {
      brand: true,
    },
  });

  console.log(`Найдено ${allProducts.length} опубликованных продуктов\n`);

  let updated = 0;
  let skipped = 0;

  for (const product of allProducts) {
    const updates: any = {};
    let hasUpdates = false;

    // 1. Priority
    if (product.priority === 0 || product.priority === null) {
      const stepPriority = STEP_PRIORITIES[product.step] || STEP_PRIORITIES[product.category] || 30;
      updates.priority = stepPriority;
      hasUpdates = true;
    }

    // 2. isHero
    if (!product.isHero) {
      const newPriority = updates.priority || product.priority || 0;
      updates.isHero = getIsHero(product.step, newPriority, product.category);
      if (updates.isHero) {
        hasUpdates = true;
      }
    }

    // 3. avoidIf
    if (!product.avoidIf || product.avoidIf.length === 0) {
      const avoidIf = getAvoidIf(product.activeIngredients as string[] || []);
      if (avoidIf.length > 0) {
        updates.avoidIf = avoidIf;
        hasUpdates = true;
      }
    }

    // 4. description и descriptionUser
    if (!product.description && !product.descriptionUser) {
      const descriptions = generateDescription(
        product.name,
        product.step,
        product.category,
        product.activeIngredients as string[] || [],
        product.concerns as string[] || []
      );
      updates.description = descriptions.description;
      updates.descriptionUser = descriptions.descriptionUser;
      hasUpdates = true;
    } else if (!product.description && product.descriptionUser) {
      // Если есть только descriptionUser, используем его как description
      updates.description = product.descriptionUser;
      hasUpdates = true;
    } else if (product.description && !product.descriptionUser) {
      // Если есть только description, используем его как descriptionUser (или создаем краткое)
      const stepName = product.step || product.category;
      if (stepName.includes('cleanser')) {
        updates.descriptionUser = 'Очищающее средство';
      } else if (stepName.includes('serum')) {
        updates.descriptionUser = 'Сыворотка для ухода';
      } else if (stepName.includes('moisturizer')) {
        updates.descriptionUser = 'Увлажняющий крем';
      } else if (stepName.includes('spf')) {
        updates.descriptionUser = 'Солнцезащитное средство';
      } else {
        updates.descriptionUser = product.description.substring(0, 100);
      }
      hasUpdates = true;
    }

    // 5. imageUrl - оставляем пустым, так как нужны реальные ссылки
    // Можно добавить placeholder или оставить null

    if (hasUpdates) {
      try {
        await prisma.product.update({
          where: { id: product.id },
          data: updates,
        });
        updated++;
        
        if (updated % 20 === 0) {
          console.log(`  Обновлено ${updated} продуктов...`);
        }
      } catch (error) {
        console.error(`  ❌ Ошибка при обновлении продукта ${product.id} (${product.name}):`, error);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Завершено!`);
  console.log(`   Обновлено: ${updated} продуктов`);
  console.log(`   Пропущено: ${skipped} продуктов (уже заполнены или ошибки)\n`);

  // Выводим статистику после обновления
  const stats = await prisma.product.groupBy({
    by: ['isHero'],
    where: { published: true },
    _count: true,
  });

  console.log('📊 Статистика после обновления:');
  for (const stat of stats) {
    console.log(`   isHero=${stat.isHero}: ${stat._count} продуктов`);
  }

  const priorityStats = await prisma.product.groupBy({
    by: ['priority'],
    where: { published: true },
    _count: true,
    orderBy: { priority: 'desc' },
  });

  console.log('\n📊 Распределение по приоритетам:');
  for (const stat of priorityStats.slice(0, 10)) {
    console.log(`   priority=${stat.priority}: ${stat._count} продуктов`);
  }

  await prisma.$disconnect();
}

fillProductFields()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
