// scripts/generate-plan-manually.ts
// Скрипт для ручной генерации плана для пользователя

import { prisma } from '../lib/db';
import { generate28DayPlan } from '../lib/plan-generator';
import { setCachedPlan } from '../lib/cache';

async function generatePlanManually() {
  const telegramId = '643160759';
  
  console.log('🔧 Ручная генерация плана для пользователя:', telegramId);
  console.log('='.repeat(60));
  
  // Находим пользователя
  const user = await prisma.user.findFirst({
    where: { telegramId },
    select: { id: true, telegramId: true, firstName: true },
  });
  
  if (!user) {
    console.log('❌ Пользователь не найден');
    await prisma.$disconnect();
    return;
  }
  
  console.log('👤 Пользователь:', user.firstName, '(' + user.telegramId + ')');
  
  // Находим последний профиль
  const profile = await prisma.skinProfile.findFirst({
    where: { userId: user.id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
  
  if (!profile) {
    console.log('❌ Профиль не найден. Нужно сначала пройти анкету.');
    await prisma.$disconnect();
    return;
  }
  
  console.log('📋 Профиль найден (версия', profile.version + ')');
  
  // Проверяем, есть ли уже план
  const existingPlan = await prisma.plan28.findFirst({
    where: {
      userId: user.id,
      profileVersion: profile.version,
    },
    select: { id: true, createdAt: true },
  });
  
  if (existingPlan) {
    console.log('⚠️  План уже существует (ID:', existingPlan.id + ')');
    console.log('   Создан:', new Date(existingPlan.createdAt).toLocaleString('ru-RU'));
    console.log('\n❓ Удалить старый план и создать новый? (y/n)');
    // Для автоматизации - удаляем старый план
    await prisma.plan28.delete({
      where: { id: existingPlan.id },
    });
    console.log('✅ Старый план удален');
  }
  
  console.log('\n🔄 Генерирую новый план...');
  
  try {
    // Генерируем план
    const generatedPlan = await generate28DayPlan(user.id);
    
    console.log('✅ План сгенерирован успешно!');
    console.log('   Дней в плане:', generatedPlan.plan28?.days?.length || 0);
    console.log('   Продуктов:', generatedPlan.products?.length || 0);
    
    // ИСПРАВЛЕНО: Сохраняем план в БД
    if (generatedPlan.plan28) {
      try {
        console.log('\n💾 Сохраняю план в БД...');
        await prisma.plan28.upsert({
          where: {
            userId_profileVersion: {
              userId: user.id,
              profileVersion: profile.version,
            },
          },
          update: {
            planData: generatedPlan.plan28 as any,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            skinProfileId: profile.id,
            profileVersion: profile.version,
            planData: generatedPlan.plan28 as any,
          },
        });
        console.log('✅ План сохранен в БД');
      } catch (dbError: any) {
        console.error('❌ Ошибка при сохранении в БД:', dbError?.message);
        throw dbError;
      }
    }
    
    // Сохраняем в кэш
    try {
      await setCachedPlan(user.id, profile.version, {
        plan28: generatedPlan.plan28!,
      });
      console.log('✅ План сохранен в кэш');
    } catch (cacheError) {
      console.warn('⚠️  Ошибка при сохранении в кэш (не критично):', cacheError);
    }
    
    console.log('\n✅ Готово! План должен отобразиться на главной странице.');
    
  } catch (error: any) {
    console.error('❌ Ошибка при генерации плана:', error);
    console.error('   Message:', error?.message);
    console.error('   Stack:', error?.stack?.substring(0, 500));
  }
  
  await prisma.$disconnect();
}

generatePlanManually().catch(console.error);
