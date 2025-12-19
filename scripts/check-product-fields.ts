// scripts/check-product-fields.ts
// Скрипт для проверки заполненности полей продуктов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductFields() {
  console.log('🔍 Проверка заполненности полей продуктов...\n');

  const allProducts = await prisma.product.findMany({
    where: {
      published: true,
    },
    select: {
      id: true,
      name: true,
      brand: {
        select: {
          name: true,
        },
      },
      imageUrl: true,
      description: true,
      descriptionUser: true,
      avoidIf: true,
      isHero: true,
      priority: true,
      step: true,
      category: true,
    },
  });

  const total = allProducts.length;
  console.log(`Всего опубликованных продуктов: ${total}\n`);

  // Статистика по полям
  const stats = {
    hasImageUrl: 0,
    hasDescription: 0,
    hasDescriptionUser: 0,
    hasAnyDescription: 0,
    hasAvoidIf: 0,
    isHero: 0,
    hasPriority: 0,
    priorityZero: 0,
    priorityNonZero: 0,
  };

  const missingFields: Array<{
    id: number;
    name: string;
    brand: string;
    missing: string[];
  }> = [];

  for (const product of allProducts) {
    const missing: string[] = [];

    if (product.imageUrl) stats.hasImageUrl++;
    else missing.push('imageUrl');

    if (product.description) stats.hasDescription++;
    if (product.descriptionUser) stats.hasDescriptionUser++;
    if (product.description || product.descriptionUser) stats.hasAnyDescription++;
    else missing.push('description/descriptionUser');

    if (product.avoidIf && product.avoidIf.length > 0) stats.hasAvoidIf++;
    else missing.push('avoidIf');

    if (product.isHero) stats.isHero++;
    else missing.push('isHero (false)');

    if (product.priority !== null && product.priority !== undefined) {
      stats.hasPriority++;
      if (product.priority === 0) stats.priorityZero++;
      else stats.priorityNonZero++;
    }
    if (product.priority === 0) missing.push('priority (0)');

    if (missing.length > 0) {
      missingFields.push({
        id: product.id,
        name: product.name,
        brand: product.brand.name,
        missing,
      });
    }
  }

  // Выводим статистику
  console.log('📊 Статистика заполненности полей:');
  console.log(`  ✅ imageUrl: ${stats.hasImageUrl}/${total} (${Math.round((stats.hasImageUrl / total) * 100)}%)`);
  console.log(`  ✅ description: ${stats.hasDescription}/${total} (${Math.round((stats.hasDescription / total) * 100)}%)`);
  console.log(`  ✅ descriptionUser: ${stats.hasDescriptionUser}/${total} (${Math.round((stats.hasDescriptionUser / total) * 100)}%)`);
  console.log(`  ✅ description или descriptionUser: ${stats.hasAnyDescription}/${total} (${Math.round((stats.hasAnyDescription / total) * 100)}%)`);
  console.log(`  ✅ avoidIf (не пустой): ${stats.hasAvoidIf}/${total} (${Math.round((stats.hasAvoidIf / total) * 100)}%)`);
  console.log(`  ✅ isHero (true): ${stats.isHero}/${total} (${Math.round((stats.isHero / total) * 100)}%)`);
  console.log(`  ✅ priority (не 0): ${stats.priorityNonZero}/${total} (${Math.round((stats.priorityNonZero / total) * 100)}%)`);
  console.log(`  ⚠️  priority (0): ${stats.priorityZero}/${total} (${Math.round((stats.priorityZero / total) * 100)}%)\n`);

  // Группируем по категориям/шагам
  const byStep: Record<string, { total: number; missing: number }> = {};
  for (const product of allProducts) {
    const step = product.step || product.category || 'unknown';
    if (!byStep[step]) {
      byStep[step] = { total: 0, missing: 0 };
    }
    byStep[step].total++;
    if (!product.imageUrl || (!product.description && !product.descriptionUser) || product.priority === 0) {
      byStep[step].missing++;
    }
  }

  console.log('📦 Статистика по шагам/категориям:');
  for (const [step, data] of Object.entries(byStep).sort((a, b) => b[1].total - a[1].total)) {
    const missingPercent = Math.round((data.missing / data.total) * 100);
    console.log(`  ${step}: ${data.total} продуктов, ${data.missing} с пустыми полями (${missingPercent}%)`);
  }
  console.log('');

  // Показываем примеры продуктов с пустыми полями
  if (missingFields.length > 0) {
    console.log(`⚠️  Найдено ${missingFields.length} продуктов с пустыми полями:\n`);
    
    // Группируем по типам отсутствующих полей
    const byMissingType: Record<string, number> = {};
    for (const item of missingFields) {
      for (const field of item.missing) {
        byMissingType[field] = (byMissingType[field] || 0) + 1;
      }
    }

    console.log('📋 Распределение по типам отсутствующих полей:');
    for (const [field, count] of Object.entries(byMissingType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${field}: ${count} продуктов`);
    }
    console.log('');

    // Показываем первые 20 примеров
    console.log('📝 Примеры продуктов с пустыми полями (первые 20):');
    for (const item of missingFields.slice(0, 20)) {
      console.log(`  [${item.id}] ${item.brand} - ${item.name}`);
      console.log(`      Отсутствует: ${item.missing.join(', ')}`);
    }
    if (missingFields.length > 20) {
      console.log(`  ... и еще ${missingFields.length - 20} продуктов`);
    }
  }

  await prisma.$disconnect();
}

checkProductFields()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
