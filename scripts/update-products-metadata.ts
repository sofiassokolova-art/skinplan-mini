// scripts/update-products-metadata.ts
// Обновление concerns и activeIngredients для существующих продуктов на основе stepCategory

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг stepCategory -> concerns и activeIngredients
const stepCategoryMetadata: Record<string, { concerns: string[]; activeIngredients: string[] }> = {
  // Сыворотки
  'serum_vitc': {
    concerns: ['pigmentation', 'dullness'],
    activeIngredients: ['vitamin_c10', 'vitamin_c15', 'vitamin_c23'],
  },
  'serum_hydrating': {
    concerns: ['dehydration'],
    activeIngredients: ['hyaluronic_acid', 'glycerin'],
  },
  'serum_niacinamide': {
    concerns: ['acne', 'pores', 'pigmentation'],
    activeIngredients: ['niacinamide'],
  },
  'serum_anti_redness': {
    concerns: ['redness', 'sensitivity'],
    activeIngredients: ['centella', 'niacinamide'],
  },
  'serum_brightening_soft': {
    concerns: ['pigmentation'],
    activeIngredients: ['alpha_arbutin', 'niacinamide'],
  },
  
  // Тонеры
  'toner_hydrating': {
    concerns: ['dehydration'],
    activeIngredients: ['hyaluronic_acid', 'glycerin'],
  },
  'toner_soothing': {
    concerns: ['redness', 'sensitivity'],
    activeIngredients: ['centella', 'panthenol'],
  },
  
  // Treatment
  'treatment_acne_bpo': {
    concerns: ['acne', 'inflammation'],
    activeIngredients: ['benzoyl_peroxide', 'benzoyl_peroxide_2_5'],
  },
  'treatment_acne_azelaic': {
    concerns: ['acne', 'pigmentation', 'redness'],
    activeIngredients: ['azelaic_acid', 'azelaic_acid_10', 'azelaic_acid_15'],
  },
  'treatment_acne_local': {
    concerns: ['acne'],
    activeIngredients: ['salicylic_acid', 'bha'],
  },
  'treatment_exfoliant_mild': {
    concerns: ['pores', 'texture'],
    activeIngredients: ['bha', 'aha'],
  },
  'treatment_exfoliant_strong': {
    concerns: ['pores', 'texture', 'acne'],
    activeIngredients: ['aha', 'bha'],
  },
  'treatment_pigmentation': {
    concerns: ['pigmentation'],
    activeIngredients: ['tranexamic_acid', 'hydroquinone'],
  },
  
  // Увлажняющие
  'moisturizer_rich': {
    concerns: ['dryness', 'barrier'],
    activeIngredients: ['ceramides', 'shea_butter', 'squalane'],
  },
  'moisturizer_light': {
    concerns: ['dehydration'],
    activeIngredients: ['hyaluronic_acid'],
  },
  'moisturizer_balancing': {
    concerns: ['oiliness', 'acne'],
    activeIngredients: ['niacinamide'],
  },
  'moisturizer_barrier': {
    concerns: ['barrier', 'dryness'],
    activeIngredients: ['ceramides'],
  },
  'moisturizer_soothing': {
    concerns: ['redness', 'sensitivity'],
    activeIngredients: ['centella', 'panthenol'],
  },
  
  // Маски
  'mask_sleeping': {
    concerns: ['dehydration', 'dullness'],
    activeIngredients: ['hyaluronic_acid', 'panthenol'],
  },
  'mask_soothing': {
    concerns: ['redness', 'sensitivity'],
    activeIngredients: ['centella', 'chamomile', 'panthenol'],
  },
  'mask_hydrating': {
    concerns: ['dehydration'],
    activeIngredients: ['hyaluronic_acid'],
  },
  'mask_clay': {
    concerns: ['pores', 'acne'],
    activeIngredients: ['clay'],
  },
  
  // SPF
  'spf_50_face': {
    concerns: ['photoaging', 'pigmentation'],
    activeIngredients: [],
  },
  'spf_50_oily': {
    concerns: ['photoaging', 'oiliness'],
    activeIngredients: ['salicylic_acid'],
  },
  'spf_50_sensitive': {
    concerns: ['photoaging', 'sensitivity'],
    activeIngredients: ['zinc_oxide', 'titanium_dioxide'],
  },
};

// Функция для определения concerns и activeIngredients по названию продукта
function inferMetadataFromName(name: string, step: string): { concerns: string[]; activeIngredients: string[] } {
  const nameLower = name.toLowerCase();
  const concerns: string[] = [];
  const activeIngredients: string[] = [];

  // Определяем concerns по названию
  if (nameLower.includes('acne') || nameLower.includes('blemish')) {
    concerns.push('acne');
  }
  if (nameLower.includes('pigment') || nameLower.includes('brighten') || nameLower.includes('vitamin c')) {
    concerns.push('pigmentation');
  }
  if (nameLower.includes('hydrat') || nameLower.includes('hyaluron') || nameLower.includes('moistur')) {
    concerns.push('dehydration');
  }
  if (nameLower.includes('redness') || nameLower.includes('soothing') || nameLower.includes('calm') || nameLower.includes('cica')) {
    concerns.push('redness', 'sensitivity');
  }
  if (nameLower.includes('barrier') || nameLower.includes('repair')) {
    concerns.push('barrier');
  }
  if (nameLower.includes('dry') || nameLower.includes('rich')) {
    concerns.push('dryness');
  }
  if (nameLower.includes('oil') || nameLower.includes('matte')) {
    concerns.push('oiliness');
  }
  if (nameLower.includes('pore')) {
    concerns.push('pores');
  }

  // Определяем activeIngredients по названию
  if (nameLower.includes('vitamin c') || nameLower.includes('vit c') || nameLower.includes('ascorbic')) {
    if (nameLower.includes('10%') || nameLower.includes('10')) {
      activeIngredients.push('vitamin_c10');
    } else if (nameLower.includes('15%') || nameLower.includes('15')) {
      activeIngredients.push('vitamin_c15');
    } else if (nameLower.includes('23%') || nameLower.includes('23')) {
      activeIngredients.push('vitamin_c23');
    } else {
      activeIngredients.push('vitamin_c10');
    }
  }
  if (nameLower.includes('niacinamide') || nameLower.includes('nicotinamide')) {
    activeIngredients.push('niacinamide');
  }
  if (nameLower.includes('hyaluron') || nameLower.includes('ha ')) {
    activeIngredients.push('hyaluronic_acid');
  }
  if (nameLower.includes('azelaic')) {
    if (nameLower.includes('10%') || nameLower.includes('10')) {
      activeIngredients.push('azelaic_acid_10');
    } else if (nameLower.includes('15%') || nameLower.includes('15')) {
      activeIngredients.push('azelaic_acid_15');
    } else {
      activeIngredients.push('azelaic_acid');
    }
  }
  if (nameLower.includes('benzoyl peroxide') || nameLower.includes('bpo')) {
    if (nameLower.includes('2.5%') || nameLower.includes('2.5')) {
      activeIngredients.push('benzoyl_peroxide_2_5');
    } else {
      activeIngredients.push('benzoyl_peroxide');
    }
  }
  if (nameLower.includes('salicylic') || nameLower.includes('bha')) {
    activeIngredients.push('salicylic_acid', 'bha');
  }
  if (nameLower.includes('centella') || nameLower.includes('cica') || nameLower.includes('tiger grass')) {
    activeIngredients.push('centella');
  }
  if (nameLower.includes('ceramide')) {
    activeIngredients.push('ceramides');
  }
  if (nameLower.includes('panthenol') || nameLower.includes('b5')) {
    activeIngredients.push('panthenol');
  }
  if (nameLower.includes('squalane')) {
    activeIngredients.push('squalane');
  }
  if (nameLower.includes('shea')) {
    activeIngredients.push('shea_butter');
  }
  if (nameLower.includes('zinc') && nameLower.includes('oxide')) {
    activeIngredients.push('zinc_oxide');
  }
  if (nameLower.includes('titanium') && nameLower.includes('dioxide')) {
    activeIngredients.push('titanium_dioxide');
  }

  return { concerns, activeIngredients };
}

async function updateProductsMetadata() {
  console.log('🔄 Обновление метаданных продуктов (concerns и activeIngredients)...\n');

  // Получаем все опубликованные продукты
  const products = await prisma.product.findMany({
    where: { published: true },
    include: { brand: true },
  });

  console.log(`Всего продуктов для обновления: ${products.length}\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    let needsUpdate = false;
    const updates: any = {};

    // Определяем concerns и activeIngredients
    let concerns: string[] = [];
    let activeIngredients: string[] = [];

    // 1. Используем существующие, если они есть
    if (product.concerns.length > 0) {
      concerns = [...product.concerns];
    }
    if (product.activeIngredients.length > 0) {
      activeIngredients = [...product.activeIngredients];
    }

    // 2. Если нет, используем метаданные из stepCategory
    if (concerns.length === 0 || activeIngredients.length === 0) {
      const stepMetadata = stepCategoryMetadata[product.step];
      if (stepMetadata) {
        if (concerns.length === 0) {
          concerns = [...stepMetadata.concerns];
        }
        if (activeIngredients.length === 0) {
          activeIngredients = [...stepMetadata.activeIngredients];
        }
      }
    }

    // 3. Если все еще нет, определяем по названию
    if (concerns.length === 0 || activeIngredients.length === 0) {
      const inferred = inferMetadataFromName(product.name, product.step);
      if (concerns.length === 0) {
        concerns = inferred.concerns;
      }
      if (activeIngredients.length === 0) {
        activeIngredients = inferred.activeIngredients;
      }
    }

    // Обновляем, если есть изменения
    if (concerns.length > 0 && JSON.stringify(concerns.sort()) !== JSON.stringify(product.concerns.sort())) {
      updates.concerns = concerns;
      needsUpdate = true;
    }

    if (activeIngredients.length > 0 && JSON.stringify(activeIngredients.sort()) !== JSON.stringify(product.activeIngredients.sort())) {
      updates.activeIngredients = activeIngredients;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.product.update({
        where: { id: product.id },
        data: updates,
      });
      updatedCount++;
      console.log(`✅ Обновлен: ${product.brand.name} - ${product.name}`);
      if (updates.concerns) {
        console.log(`   concerns: [${updates.concerns.join(', ')}]`);
      }
      if (updates.activeIngredients) {
        console.log(`   activeIngredients: [${updates.activeIngredients.join(', ')}]`);
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n🎉 Обновление завершено!`);
  console.log(`   ✅ Обновлено: ${updatedCount} продуктов`);
  console.log(`   ⏭️  Пропущено: ${skippedCount} продуктов (уже заполнены)`);
}

updateProductsMetadata()
  .catch((error) => {
    console.error('❌ Ошибка при обновлении:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

