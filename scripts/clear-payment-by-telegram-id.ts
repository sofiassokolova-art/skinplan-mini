// scripts/clear-payment-by-telegram-id.ts
// Очищает флаг оплаты для пользователя: удаляет Payment и Entitlement, сбрасывает флаги в UserPreferences.
// Использование: npx tsx scripts/clear-payment-by-telegram-id.ts <telegramId>

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function clearPaymentByTelegramId(telegramId: string) {
  console.log(`\n🔄 Очистка флага оплаты для пользователя telegramId: ${telegramId}\n`);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, telegramId: true, firstName: true, lastName: true },
  });

  if (!user) {
    console.error(`❌ Пользователь с telegramId ${telegramId} не найден`);
    process.exit(1);
  }

  console.log(`✅ Найден пользователь: ${user.firstName || ''} ${user.lastName || ''} (ID: ${user.id})\n`);

  try {
    await invalidateAllUserCache(user.id);
    console.log('   ✅ Кэш очищен');
  } catch (e: any) {
    console.warn('   ⚠️  Ошибка очистки кэша (не критично):', e?.message);
  }

  const entitlements = await prisma.entitlement.deleteMany({ where: { userId: user.id } });
  console.log(`   ✅ Entitlement удалено: ${entitlements.count}`);

  const payments = await prisma.payment.deleteMany({ where: { userId: user.id } });
  console.log(`   ✅ Payment удалено: ${payments.count}`);

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: {
      paymentRetakingCompleted: false,
      paymentFullRetakeCompleted: false,
    },
    create: {
      userId: user.id,
      paymentRetakingCompleted: false,
      paymentFullRetakeCompleted: false,
    },
  });
  console.log('   ✅ UserPreferences: флаги оплаты сброшены');

  console.log('\n✅ Флаг оплаты очищен.\n');
}

const telegramId = process.argv[2];
if (!telegramId) {
  console.error('Использование: npx tsx scripts/clear-payment-by-telegram-id.ts <telegramId>');
  process.exit(1);
}

clearPaymentByTelegramId(telegramId)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
