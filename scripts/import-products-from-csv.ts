// scripts/import-products-from-csv.ts
// Скрипт для импорта продуктов из CSV файла Gold Apple

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Функция для создания slug из названия
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100); // Ограничиваем длину
}

// Функция для парсинга строки с запятыми в массив
function parseArrayString(str: string | undefined): string[] {
  if (!str || str.trim() === '') return [];
  return str
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

// Функция для парсинга CSV строки
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

interface CSVProduct {
  name: string;
  brand: string;
  link: string;
  step: string; // stepCategory
  category: string; // базовый шаг
  skinTypes: string[];
  concerns: string[];
  activeIngredients: string[];
  avoidIf: string[];
  isHero: boolean;
  priority: number;
  published: boolean;
  price?: number | null;
  volume?: string | null;
  description?: string | null;
  descriptionUser?: string | null;
  composition?: string | null;
}

async function importProductsFromCSV(csvFilePath: string) {
  console.log('📦 Начинаю импорт продуктов из CSV...');
  console.log(`📄 Файл: ${csvFilePath}`);

  // Читаем CSV файл
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    console.error('❌ CSV файл пуст или содержит только заголовки');
    return;
  }

  // Парсим заголовки
  const headers = parseCSVLine(lines[0]);
  console.log(`📋 Найдено колонок: ${headers.length}`);
  console.log(`📋 Заголовки: ${headers.join(', ')}`);

  // Индексы колонок
  const nameIdx = headers.indexOf('Название');
  const slugIdx = headers.indexOf('Slug');
  const brandIdx = headers.indexOf('Бренд');
  const priceIdx = headers.indexOf('Цена');
  const volumeIdx = headers.indexOf('Объем');
  const descriptionIdx = headers.indexOf('Описание');
  const descriptionUserIdx = headers.indexOf('Описание для пользователя');
  const compositionIdx = headers.indexOf('Состав');
  const linkIdx = headers.indexOf('Ссылка');
  const stepIdx = headers.indexOf('Шаг');
  const categoryIdx = headers.indexOf('Категория');
  const skinTypesIdx = headers.indexOf('Типы кожи');
  const concernsIdx = headers.indexOf('Проблемы');
  const activeIngredientsIdx = headers.indexOf('Активные ингредиенты');
  const avoidIfIdx = headers.indexOf('Избегать при');
  const heroIdx = headers.indexOf('Hero');
  const priorityIdx = headers.indexOf('Приоритет');
  const publishedIdx = headers.indexOf('Опубликован');

  // Проверяем наличие обязательных колонок
  const requiredColumns = [nameIdx, brandIdx, linkIdx, stepIdx, categoryIdx];
  if (requiredColumns.some(idx => idx === -1)) {
    console.error('❌ Не найдены обязательные колонки в CSV');
    console.error(`   Название: ${nameIdx}, Бренд: ${brandIdx}, Ссылка: ${linkIdx}, Шаг: ${stepIdx}, Категория: ${categoryIdx}`);
    return;
  }

  // Парсим данные
  const products: CSVProduct[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < headers.length) {
      console.warn(`⚠️  Строка ${i + 1} имеет меньше значений, чем заголовков. Пропускаю.`);
      continue;
    }

    const name = values[nameIdx]?.trim();
    const brand = values[brandIdx]?.trim();
    
    if (!name || !brand) {
      console.warn(`⚠️  Строка ${i + 1}: пропущена (нет названия или бренда)`);
      continue;
    }

    const skinTypesStr = values[skinTypesIdx] || '';
    const concernsStr = values[concernsIdx] || '';
    const activeIngredientsStr = values[activeIngredientsIdx] || '';
    const avoidIfStr = values[avoidIfIdx] || '';

    const product: CSVProduct = {
      name,
      brand,
      link: values[linkIdx]?.trim() || null,
      step: values[stepIdx]?.trim() || values[categoryIdx]?.trim() || '', // stepCategory (moisturizer_rich, mask_sleeping и т.д.)
      category: values[categoryIdx]?.trim() || (values[stepIdx]?.trim() ? values[stepIdx].trim().split('_')[0] : '') || '', // Базовый шаг из stepCategory
      skinTypes: parseArrayString(skinTypesStr),
      concerns: parseArrayString(concernsStr),
      activeIngredients: parseArrayString(activeIngredientsStr),
      avoidIf: parseArrayString(avoidIfStr),
      isHero: values[heroIdx]?.trim().toLowerCase() === 'да' || false,
      priority: parseInt(values[priorityIdx] || '0', 10) || 0,
      published: values[publishedIdx]?.trim().toLowerCase() === 'да' || false,
      price: values[priceIdx]?.trim() ? parseInt(values[priceIdx].trim(), 10) : null,
      volume: values[volumeIdx]?.trim() || null,
      description: values[descriptionIdx]?.trim() || null,
      descriptionUser: values[descriptionUserIdx]?.trim() || null,
      composition: values[compositionIdx]?.trim() || null,
    };

    products.push(product);
  }

  console.log(`✅ Распарсено продуктов: ${products.length}`);

  // Создаем/находим бренды
  const brandMap = new Map<string, number>();
  const uniqueBrands = new Set(products.map(p => p.brand));

  console.log(`\n🏷️  Обрабатываю бренды (${uniqueBrands.size} уникальных)...`);

  for (const brandName of uniqueBrands) {
    const brand = await prisma.brand.upsert({
      where: { name: brandName },
      update: {
        isActive: true, // Обновляем статус при импорте
      },
      create: {
        name: brandName,
        slug: createSlug(brandName),
        isActive: true,
      },
    });
    
    brandMap.set(brandName, brand.id);
    console.log(`  ✅ Бренд: ${brandName} (ID: ${brand.id})`);
  }

  // Создаем продукты
  console.log(`\n📦 Создаю/обновляю продукты (${products.length} шт.)...`);
  
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const productData of products) {
    const brandId = brandMap.get(productData.brand);
    
    if (!brandId) {
      console.warn(`⚠️  Бренд не найден: ${productData.brand} для продукта ${productData.name}`);
      skippedCount++;
      continue;
    }

    // Генерируем slug
    const slug = createSlug(`${productData.brand} ${productData.name}`);

    // Проверяем существующий продукт
    const existing = await prisma.product.findFirst({
      where: {
        brandId,
        name: productData.name,
      },
    });

    const productPayload = {
      brandId,
      name: productData.name,
      slug,
      step: productData.step, // stepCategory (moisturizer_rich, mask_sleeping и т.д.)
      category: productData.category, // базовый шаг (moisturizer, mask, spf и т.д.)
      skinTypes: productData.skinTypes,
      concerns: productData.concerns,
      activeIngredients: productData.activeIngredients,
      avoidIf: productData.avoidIf,
      isHero: productData.isHero,
      priority: productData.priority,
      published: productData.published,
      status: productData.published ? 'published' : 'draft',
      link: productData.link,
      price: productData.price,
      volume: productData.volume,
      description: productData.description,
      descriptionUser: productData.descriptionUser,
      composition: productData.composition,
    };

    if (existing) {
      // Обновляем существующий продукт
      await prisma.product.update({
        where: { id: existing.id },
        data: productPayload,
      });
      updatedCount++;
      console.log(`  🔄 Обновлен: ${productData.brand} - ${productData.name}`);
    } else {
      // Создаем новый продукт
      await prisma.product.create({
        data: productPayload,
      });
      createdCount++;
      console.log(`  ✅ Создан: ${productData.brand} - ${productData.name}`);
    }
  }

  console.log(`\n🎉 Импорт завершен!`);
  console.log(`   ✅ Создано: ${createdCount} продуктов`);
  console.log(`   🔄 Обновлено: ${updatedCount} продуктов`);
  console.log(`   ⚠️  Пропущено: ${skippedCount} продуктов`);
  console.log(`   📊 Всего обработано: ${createdCount + updatedCount} продуктов`);
}

// Запуск скрипта
const csvFilePath = process.argv[2] || path.join(process.cwd(), 'scripts/goldapple-import.csv');

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ Файл не найден: ${csvFilePath}`);
  console.error(`   Использование: npx tsx scripts/import-products-from-csv.ts <путь-к-csv-файлу>`);
  process.exit(1);
}

importProductsFromCSV(csvFilePath)
  .catch((error) => {
    console.error('❌ Ошибка при импорте:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

