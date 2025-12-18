// scripts/check-user-payments.ts
// Проверка платежей и entitlements пользователя

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserPayments(telegramId: string) {
  try {
    console.log(`🔍 Ищу платежи для пользователя с telegramId: ${telegramId}`);
    
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log('✅ Пользователь найден:', {
      id: user.id,
      telegramId: user.telegramId,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'не указано',
    });

    // Получаем все платежи пользователя
    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n💳 Платежи (${payments.length}):`);
    if (payments.length === 0) {
      console.log('   Нет платежей');
    } else {
      payments.forEach((payment, idx) => {
        console.log(`\n   ${idx + 1}. [${payment.createdAt.toLocaleString('ru-RU')}]`);
        console.log(`      ID: ${payment.id}`);
        console.log(`      Статус: ${payment.status}`);
        console.log(`      Продукт: ${payment.productCode}`);
        console.log(`      Сумма: ${payment.amount / 100} ${payment.currency}`);
        console.log(`      Провайдер: ${payment.provider}`);
        console.log(`      Provider Payment ID: ${payment.providerPaymentId || 'нет'}`);
        console.log(`      Idempotency Key: ${payment.idempotencyKey}`);
      });
    }

    // Получаем все entitlements пользователя
    const entitlements = await prisma.entitlement.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(`\n🔐 Доступ (Entitlements) (${entitlements.length}):`);
    if (entitlements.length === 0) {
      console.log('   Нет entitlements');
    } else {
      entitlements.forEach((entitlement, idx) => {
        console.log(`\n   ${idx + 1}. [${entitlement.updatedAt.toLocaleString('ru-RU')}]`);
        console.log(`      Код: ${entitlement.code}`);
        console.log(`      Активен: ${entitlement.active}`);
        console.log(`      Действителен до: ${entitlement.validUntil ? entitlement.validUntil.toLocaleString('ru-RU') : 'бессрочно'}`);
        console.log(`      Последний платеж ID: ${entitlement.lastPaymentId || 'нет'}`);
        
        // Проверяем, не истек ли доступ
        if (entitlement.validUntil && entitlement.validUntil < new Date()) {
          console.log(`      ⚠️ Доступ истек!`);
        } else if (entitlement.active) {
          console.log(`      ✅ Доступ активен`);
        }
      });
    }

    // Проверяем активный доступ
    const activeEntitlement = entitlements.find(
      (e) => e.code === 'paid_access' && 
            e.active === true && 
            (!e.validUntil || e.validUntil > new Date())
    );

    console.log(`\n📊 Статус доступа:`);
    if (activeEntitlement) {
      console.log(`   ✅ Пользователь имеет активный доступ`);
      console.log(`   Действителен до: ${activeEntitlement.validUntil ? activeEntitlement.validUntil.toLocaleString('ru-RU') : 'бессрочно'}`);
    } else {
      console.log(`   ❌ Пользователь не имеет активного доступа`);
    }

    // Проверяем последние успешные платежи
    const succeededPayments = payments.filter(p => p.status === 'succeeded');
    console.log(`\n✅ Успешные платежи: ${succeededPayments.length}`);
    if (succeededPayments.length > 0) {
      succeededPayments.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. ${payment.createdAt.toLocaleString('ru-RU')} - ${payment.productCode} - ${payment.amount / 100} ${payment.currency}`);
      });
    }

    // Проверяем pending платежи
    const pendingPayments = payments.filter(p => p.status === 'pending');
    console.log(`\n⏳ Ожидающие платежи: ${pendingPayments.length}`);
    if (pendingPayments.length > 0) {
      pendingPayments.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. ${payment.createdAt.toLocaleString('ru-RU')} - ${payment.productCode} - ${payment.amount / 100} ${payment.currency}`);
        console.log(`      Provider Payment ID: ${payment.providerPaymentId || 'нет'}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Ошибка при проверке платежей:', error);
    if (error?.code === 'P2025') {
      console.error('   Таблица payments или entitlements не существует. Нужно применить миграции.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем проверку для пользователя
const telegramId = process.argv[2] || '643160759';
checkUserPayments(telegramId);
