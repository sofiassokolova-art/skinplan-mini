// scripts/check-rule-23-matching.ts
// Диагностика: почему Rule 23 "Беременность и ГВ" подходит всем
// Проверяет hasPregnancy в профилях и условия правила

import { prisma } from '../lib/db';

async function checkRule23Matching() {
  console.log('🔍 Проверка Rule 23 "Беременность и ГВ — безопасный уход"\n');

  const rule = await prisma.recommendationRule.findUnique({
    where: { id: 23 },
    select: { name: true, conditionsJson: true, priority: true },
  });

  if (!rule) {
    console.log('❌ Rule 23 не найден');
    await prisma.$disconnect();
    return;
  }

  console.log('📋 Rule 23:');
  console.log('   Name:', rule.name);
  console.log('   Priority:', rule.priority);
  console.log('   Conditions:', JSON.stringify(rule.conditionsJson, null, 2));
  console.log('   → Правило срабатывает при pregnant: true\n');

  // Профили с hasPregnancy
  const profilesWithPregnancy = await prisma.skinProfile.count({
    where: { hasPregnancy: true },
  });
  const profilesWithoutPregnancy = await prisma.skinProfile.count({
    where: { hasPregnancy: false },
  });
  const profilesNullPregnancy = await prisma.skinProfile.count({
    where: { hasPregnancy: null },
  });

  console.log('📊 Профили по hasPregnancy:');
  console.log('   hasPregnancy = true:', profilesWithPregnancy);
  console.log('   hasPregnancy = false:', profilesWithoutPregnancy);
  console.log('   hasPregnancy = null:', profilesNullPregnancy);

  // RecommendationSessions с Rule 23
  const sessionsRule23 = await prisma.recommendationSession.findMany({
    where: { ruleId: 23 },
    include: {
      user: { select: { telegramId: true, firstName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`\n📦 RecommendationSessions с Rule 23: ${sessionsRule23.length}`);

  for (const s of sessionsRule23) {
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: s.userId },
      orderBy: { version: 'desc' },
      select: { skinType: true, hasPregnancy: true, version: true },
    });
    console.log(`   ${s.user?.firstName || '?'} (${s.user?.telegramId || '?'}): skinType=${profile?.skinType || 'N/A'}, hasPregnancy=${profile?.hasPregnancy}`);
  }

  // Рекомендация: нужны ли отдельные правила для skinType при беременности?
  console.log('\n📌 Рекомендации:');
  console.log('   1. Rule 23 срабатывает при pregnant=true, priority=100');
  console.log('   2. Правила с более высоким приоритетом (100) проверяются первыми: melasma, atopic, pregnancy, acne 3-4');
  console.log('   3. Для разнообразия при беременности можно добавить правила:');
  console.log('      - pregnant + dry skin (другой набор шагов/продуктов)');
  console.log('      - pregnant + oily skin');
  console.log('      - pregnant + sensitive + rosacea');
  console.log('   4. Текущий Rule 23 не учитывает skinType — один набор для всех беременных');

  await prisma.$disconnect();
}

checkRule23Matching()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  });
