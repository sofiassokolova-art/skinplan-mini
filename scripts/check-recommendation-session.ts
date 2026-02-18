// scripts/check-recommendation-session.ts
// Проверка наличия RecommendationSession для пользователя по telegramId.
// Запуск: npx tsx scripts/check-recommendation-session.ts [telegramId]
// Пример: npx tsx scripts/check-recommendation-session.ts 643160759

import { prisma } from '../lib/db';

const telegramId = process.argv[2] || '643160759';

async function main() {
  const user = await prisma.user.findFirst({
    where: { telegramId },
    select: { id: true, telegramId: true, firstName: true, createdAt: true },
  });

  if (!user) {
    console.log('❌ Пользователь с telegramId', telegramId, 'не найден');
    await prisma.$disconnect();
    return;
  }

  console.log('👤 Пользователь:', { userId: user.id, telegramId: user.telegramId, name: user.firstName });

  const sessions = await prisma.recommendationSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { profile: { select: { id: true, version: true, createdAt: true } } },
  });

  if (sessions.length === 0) {
    console.log('\n💾 RecommendationSession для этого пользователя не найдены.');
    console.log('   (Сессии могли быть удалены после генерации плана или не создавались.)');
  } else {
    console.log('\n💾 RecommendationSession:', sessions.length);
    sessions.forEach((s, i) => {
      const time = new Date(s.createdAt).toLocaleString('ru-RU');
      const productsCount = Array.isArray(s.products) ? s.products.length : 0;
      console.log(`   ${i + 1}. [${time}] id=${s.id}, profileId=${s.profileId}, products=${productsCount}, ruleId=${s.ruleId ?? '—'}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
