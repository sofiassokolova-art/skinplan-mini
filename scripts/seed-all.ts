// scripts/seed-all.ts
// Скрипт для заполнения всех начальных данных

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function seedAll() {
  console.log('🌱 Seeding all data...\n');

  try {
    console.log('1️⃣ Seeding questionnaire...');
    await execAsync('npx tsx scripts/seed-questionnaire.ts');
    console.log('✅ Questionnaire seeded\n');

    console.log('2️⃣ Seeding products...');
    await execAsync('npx tsx scripts/seed-products.ts');
    console.log('✅ Products seeded\n');

    console.log('3️⃣ Seeding rules...');
    await execAsync('npx tsx scripts/seed-rules.ts');
    console.log('✅ Rules seeded\n');

    console.log('🎉 All data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding:', error);
    process.exit(1);
  }
}

seedAll();
