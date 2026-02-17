// scripts/compare-plans-products.ts
// Сравнение продуктов в планах разных пользователей — один ли набор для всех

import { prisma } from '../lib/db';

function extractProductIdsFromPlan(planData: any): number[] {
  const ids = new Set<number>();
  const days = planData?.days ?? planData?.weeks?.flatMap((w: any) => w.days ?? []) ?? [];
  for (const day of days) {
    const morning = day.morning ?? [];
    const evening = day.evening ?? [];
    for (const item of morning.concat(evening)) {
      let id: number | null = null;
      if (typeof item === 'number' && !isNaN(item)) id = item;
      else if (typeof item === 'object' && item?.productId != null)
        id = typeof item.productId === 'string' ? parseInt(item.productId, 10) : item.productId;
      if (typeof id === 'number' && !isNaN(id)) ids.add(id);
    }
  }
  return Array.from(ids).sort((a, b) => a - b);
}

async function comparePlansProducts() {
  console.log('🔍 Сравнение продуктов в планах разных пользователей\n');

  const plans = await prisma.plan28.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: {
        select: { telegramId: true, firstName: true },
      },
      skinProfile: {
        select: { skinType: true, version: true, sensitivityLevel: true },
      },
    },
  });

  console.log(`📊 Найдено планов: ${plans.length}\n`);

  const plansWithProducts = plans.map((p) => {
    const planData = p.planData as any;
    const productIds = extractProductIdsFromPlan(planData);
    return {
      userId: p.userId,
      planId: p.id,
      telegramId: p.user?.telegramId ?? 'N/A',
      name: p.user?.firstName ?? 'Unknown',
      skinType: p.skinProfile?.skinType ?? 'unknown',
      version: p.skinProfile?.version ?? 0,
      sensitivityLevel: p.skinProfile?.sensitivityLevel ?? 'N/A',
      productIds,
      productIdsStr: productIds.join(','),
      createdAt: p.createdAt,
    };
  });

  // Группируем по набору продуктов
  const byProductSet = new Map<string, typeof plansWithProducts>();
  for (const p of plansWithProducts) {
    const key = p.productIdsStr;
    if (!byProductSet.has(key)) byProductSet.set(key, []);
    byProductSet.get(key)!.push(p);
  }

  console.log(`📦 Уникальных наборов продуктов: ${byProductSet.size}`);
  if (byProductSet.size === 1 && plansWithProducts.length > 1) {
    console.log('\n⚠️ ВНИМАНИЕ: У ВСЕХ пользователей один и тот же набор продуктов!\n');
  } else if (byProductSet.size > 1) {
    console.log('\n✅ У разных пользователей разные наборы продуктов.\n');
  }

  const productDetails = await prisma.product.findMany({
    where: {
      id: {
        in: Array.from(new Set(plansWithProducts.flatMap((p) => p.productIds))),
      },
    },
    select: {
      id: true,
      name: true,
      step: true,
      category: true,
      brand: { select: { name: true } },
    },
  });
  const productMap = new Map(productDetails.map((p) => [p.id, p]));

  console.log('📋 Наборы продуктов по группам:\n');
  for (const [key, group] of byProductSet) {
    const first = group[0];
    const skinTypes = [...new Set(group.map((p) => p.skinType))];
    const users = group.map((p) => `${p.name} (${p.telegramId})`).join(', ');
    console.log(`   Группа: ${group.length} планов, skinTypes: [${skinTypes.join(', ')}]`);
    console.log(`   Пользователи: ${users}`);
    console.log(`   Product IDs: ${first.productIds.join(', ')}`);
    for (const id of first.productIds.slice(0, 8)) {
      const prod = productMap.get(id);
      console.log(`      - ${prod?.name ?? id} (${prod?.brand?.name ?? '?'}) [${prod?.step ?? '?'}]`);
    }
    if (first.productIds.length > 8) {
      console.log(`      ... и ещё ${first.productIds.length - 8} продуктов`);
    }
    console.log('');
  }

  // Проверяем RecommendationSession и Rule для каждого пользователя
  console.log('\n📋 RecommendationSession и правила по пользователям:\n');
  const userIds = [...new Set(plans.map((p) => p.userId))];
  const sessions = await prisma.recommendationSession.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { telegramId: true, firstName: true } },
      rule: { select: { id: true, name: true } },
    },
  });

  const sessionsByUser = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!sessionsByUser.has(s.userId)) sessionsByUser.set(s.userId, []);
    sessionsByUser.get(s.userId)!.push(s);
  }

  for (const p of plansWithProducts.slice(0, 10)) {
    const userSessions = sessionsByUser.get(p.userId) ?? [];
    const latest = userSessions[0];
    console.log(`   ${p.name} (${p.telegramId}), skinType: ${p.skinType}`);
    if (latest) {
      console.log(`      Rule: ${latest.rule?.name ?? 'N/A'} (ID: ${latest.ruleId ?? 'N/A'})`);
      const prodCount = Array.isArray(latest.products) ? latest.products.length : 0;
      console.log(`      Products in session: ${prodCount}`);
    } else {
      console.log(`      RecommendationSession: не найдена`);
    }
    console.log('');
  }

  // Проверяем логи с fallback
  const fallbackLogs = await prisma.clientLog.findMany({
    where: {
      OR: [
        { message: { contains: 'fallback', mode: 'insensitive' } },
        { message: { contains: 'Fallback', mode: 'insensitive' } },
        { message: { contains: 'default_balanced', mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { telegramId: true, firstName: true } } },
  });

  console.log(`\n📋 Логи с fallback/default_balanced: ${fallbackLogs.length}`);
  if (fallbackLogs.length > 0) {
    fallbackLogs.slice(0, 5).forEach((log) => {
      console.log(`   [${log.createdAt.toLocaleString('ru-RU')}] ${log.user?.firstName ?? '?'} (${log.user?.telegramId ?? '?'}): ${log.message}`);
    });
  } else {
    console.log('   (Логи fallback в БД не сохраняются — только error/warn по умолчанию)');
  }

  await prisma.$disconnect();
}

comparePlansProducts()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  });
