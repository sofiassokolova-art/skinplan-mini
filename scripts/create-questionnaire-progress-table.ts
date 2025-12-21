// scripts/create-questionnaire-progress-table.ts
// Создание таблицы questionnaire_progress, если её нет

import { prisma } from '../lib/db';

async function createQuestionnaireProgressTable() {
  console.log('🔍 Проверяю наличие таблицы questionnaire_progress...\n');

  try {
    // Проверяем, существует ли таблица
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'questionnaire_progress'
      ) as exists;
    `;

    if (tableExists[0]?.exists) {
      console.log('✅ Таблица questionnaire_progress уже существует');
      await prisma.$disconnect();
      return;
    }

    console.log('📝 Таблица не найдена, создаю...\n');

    // Создаем таблицу
    await prisma.$executeRaw`
      CREATE TABLE "questionnaire_progress" (
        "id" SERIAL NOT NULL,
        "user_id" TEXT NOT NULL,
        "questionnaire_id" INTEGER NOT NULL,
        "question_index" INTEGER NOT NULL DEFAULT 0,
        "info_screen_index" INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP(3) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "questionnaire_progress_pkey" PRIMARY KEY ("id")
      );
    `;

    console.log('✅ Таблица создана');

    // Создаем уникальный индекс
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX "questionnaire_progress_user_id_questionnaire_id_key" 
      ON "questionnaire_progress"("user_id", "questionnaire_id");
    `;

    console.log('✅ Уникальный индекс создан');

    // Создаем индексы
    await prisma.$executeRaw`
      CREATE INDEX "questionnaire_progress_user_id_idx" 
      ON "questionnaire_progress"("user_id");
    `;

    await prisma.$executeRaw`
      CREATE INDEX "questionnaire_progress_questionnaire_id_idx" 
      ON "questionnaire_progress"("questionnaire_id");
    `;

    console.log('✅ Индексы созданы');

    // Создаем внешние ключи
    await prisma.$executeRaw`
      ALTER TABLE "questionnaire_progress" 
      ADD CONSTRAINT "questionnaire_progress_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    await prisma.$executeRaw`
      ALTER TABLE "questionnaire_progress" 
      ADD CONSTRAINT "questionnaire_progress_questionnaire_id_fkey" 
      FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `;

    console.log('✅ Внешние ключи созданы');
    console.log('\n✅ Таблица questionnaire_progress успешно создана!');

  } catch (error: any) {
    // Если constraint уже существует - это нормально
    if (error?.code === '42710' || error?.message?.includes('already exists')) {
      console.log('⚠️ Некоторые объекты уже существуют, но таблица должна быть создана');
      console.log('Проверяю наличие таблицы...');
      
      const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'questionnaire_progress'
        ) as exists;
      `;

      if (tableExists[0]?.exists) {
        console.log('✅ Таблица questionnaire_progress существует');
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

createQuestionnaireProgressTable()
  .then(() => {
    console.log('\n✅ Скрипт завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });

