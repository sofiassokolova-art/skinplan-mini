// scripts/create-user-preferences-table.ts
// Создание таблицы user_preferences, если её нет

import { prisma } from '../lib/db';

async function createUserPreferencesTable() {
  console.log('🔍 Проверяю наличие таблицы user_preferences...\n');

  try {
    // Проверяем, существует ли таблица
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_preferences'
      ) as exists;
    `;

    if (tableExists[0]?.exists) {
      console.log('✅ Таблица user_preferences уже существует');
      await prisma.$disconnect();
      return;
    }

    console.log('📝 Таблица не найдена, создаю...\n');

    // Создаем таблицу
    await prisma.$executeRaw`
      CREATE TABLE "user_preferences" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "is_retaking_quiz" BOOLEAN NOT NULL DEFAULT false,
        "full_retake_from_home" BOOLEAN NOT NULL DEFAULT false,
        "payment_retaking_completed" BOOLEAN NOT NULL DEFAULT false,
        "payment_full_retake_completed" BOOLEAN NOT NULL DEFAULT false,
        "has_plan_progress" BOOLEAN NOT NULL DEFAULT false,
        "routine_products" JSONB,
        "plan_feedback_sent" BOOLEAN NOT NULL DEFAULT false,
        "service_feedback_sent" BOOLEAN NOT NULL DEFAULT false,
        "last_plan_feedback_date" TIMESTAMP(3),
        "last_service_feedback_date" TIMESTAMP(3),
        "extra" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
      );
    `;

    console.log('✅ Таблица создана');

    // Создаем уникальный индекс на user_id
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX "user_preferences_user_id_key" 
      ON "user_preferences"("user_id");
    `;

    console.log('✅ Уникальный индекс создан');

    // Создаем индекс на user_id
    await prisma.$executeRaw`
      CREATE INDEX "user_preferences_user_id_idx" 
      ON "user_preferences"("user_id");
    `;

    console.log('✅ Индекс создан');

    // Создаем внешний ключ
    await prisma.$executeRaw`
      ALTER TABLE "user_preferences" 
      ADD CONSTRAINT "user_preferences_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    console.log('✅ Внешний ключ создан');
    console.log('\n✅ Таблица user_preferences успешно создана!');

  } catch (error: any) {
    // Если constraint уже существует - это нормально
    if (error?.code === '42710' || error?.message?.includes('already exists')) {
      console.log('⚠️ Некоторые объекты уже существуют, но таблица должна быть создана');
      console.log('Проверяю наличие таблицы...');
      
      const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_preferences'
        ) as exists;
      `;

      if (tableExists[0]?.exists) {
        console.log('✅ Таблица user_preferences существует');
      } else {
        console.error('❌ Ошибка при создании таблицы:', error);
        throw error;
      }
    } else {
      console.error('❌ Ошибка при создании таблицы:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

createUserPreferencesTable()
  .then(() => {
    console.log('\n✅ Скрипт завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });

