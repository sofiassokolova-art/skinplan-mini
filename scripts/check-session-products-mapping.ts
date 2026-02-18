// scripts/check-session-products-mapping.ts
// Проверка маппинга step/category продуктов из RecommendationSession в StepCategory (реальный mapStepToStepCategory из lib/step-matching)

import { prisma } from '../lib/db';
import { mapStepToStepCategory } from '../lib/step-matching';

const telegramId = process.argv[2] || '643160759';

async function main() {
  const user = await prisma.user.findFirst({
    where: { telegramId },
    select: { id: true, telegramId: true, firstName: true },
  });
  if (!user) {
    console.log('❌ Пользователь не найден');
    await prisma.$disconnect();
    return;
  }

  const profile = await prisma.skinProfile.findFirst({
    where: { userId: user.id },
    orderBy: { version: 'desc' },
    select: { skinType: true, version: true },
  });
  const skinType = profile?.skinType ?? null;

  const session = await prisma.recommendationSession.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!session || !Array.isArray(session.products) || session.products.length === 0) {
    console.log('❌ RecommendationSession не найдена или пуста');
    await prisma.$disconnect();
    return;
  }

  const productIds = session.products as number[];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, step: true, category: true },
  });

  console.log('👤 Пользователь:', user.telegramId, user.firstName);
  console.log('👤 Профиль: skinType =', skinType ?? 'null', ', version =', profile?.version);
  console.log('💾 Сессия: id =', session.id, ', продуктов =', products.length);
  console.log('');
  console.log('📦 Маппинг step/category → StepCategory (lib/step-matching):');
  console.log('─'.repeat(80));

  const stepCoverage = new Map<string, number>();
  const requiredSerum = ['serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_antiage', 'serum_peptide'];
  const requiredTreatment = ['treatment_antiage', 'treatment_acne_azelaic', 'treatment_exfoliant_mild', 'spot_treatment'];
  const requiredMask = ['mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping', 'mask_enzyme', 'mask_acid'];

  for (const p of products) {
    const mapped = mapStepToStepCategory(p.step, p.category, skinType ?? undefined);
    console.log(`  ID ${p.id}: ${p.name}`);
    console.log(`    step: "${p.step ?? ''}"  category: "${p.category ?? ''}"`);
    console.log(`    → ${mapped.length ? mapped.join(', ') : '⚠️ НЕ МАППИТСЯ'}`);
    console.log('');
    for (const step of mapped) {
      stepCoverage.set(step, (stepCoverage.get(step) ?? 0) + 1);
    }
  }

  console.log('─'.repeat(80));
  console.log('📊 Покрытие шагов (из продуктов сессии):');
  const allSteps = new Set([...stepCoverage.keys()].sort());
  for (const step of allSteps) {
    const count = stepCoverage.get(step)!;
    const tag = step.startsWith('serum_') ? ' [SERUM]' : step.startsWith('treatment_') || step.startsWith('spot_') ? ' [TREATMENT]' : step.startsWith('mask_') ? ' [MASK]' : '';
    console.log(`  ${step}: ${count} продукт(ов)${tag}`);
  }

  const hasSerum = requiredSerum.some(s => stepCoverage.has(s));
  const hasTreatment = requiredTreatment.some(s => stepCoverage.has(s));
  const hasMask = requiredMask.some(s => stepCoverage.has(s));
  console.log('');
  console.log('🔍 Обязательные группы для плана:');
  console.log('  serum_*:   ', hasSerum ? '✅ есть' : '❌ нет');
  console.log('  treatment_*:', hasTreatment ? '✅ есть' : '❌ нет');
  console.log('  mask_*:    ', hasMask ? '✅ есть' : '❌ нет');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
