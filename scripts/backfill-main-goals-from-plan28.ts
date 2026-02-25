// scripts/backfill-main-goals-from-plan28.ts
// Одноразовый скрипт: проставить medicalMarkers.mainGoals в SkinProfile
// на основе уже сгенерированных Plan28.planData.mainGoals

import { prisma } from '@/lib/db';

async function main() {
  console.log('🔄 Backfill mainGoals from Plan28 → SkinProfile.medicalMarkers ...');

  const plans = await prisma.plan28.findMany({
    select: {
      id: true,
      skinProfileId: true,
      planData: true,
    },
  });

  let updated = 0;
  let skippedNoGoals = 0;
  let skippedHasMarkers = 0;

  for (const plan of plans as any[]) {
    const planData = plan.planData as any;
    const planMainGoals: string[] = Array.isArray(planData?.mainGoals)
      ? planData.mainGoals
      : [];

    if (!planMainGoals || planMainGoals.length === 0) {
      skippedNoGoals++;
      continue;
    }

    const profile = await prisma.skinProfile.findUnique({
      where: { id: plan.skinProfileId },
      select: {
        id: true,
        medicalMarkers: true,
      },
    });

    if (!profile) {
      continue;
    }

    const markers = (profile.medicalMarkers || {}) as any;

    // Если mainGoals уже есть и не пустые — не трогаем, чтобы не перезаписать руками выставленные данные
    if (Array.isArray(markers.mainGoals) && markers.mainGoals.length > 0) {
      skippedHasMarkers++;
      continue;
    }

    const nextMarkers = {
      ...markers,
      mainGoals: planMainGoals,
    };

    await prisma.skinProfile.update({
      where: { id: profile.id },
      data: {
        medicalMarkers: nextMarkers as any,
      },
    });

    updated++;
  }

  console.log('✅ Backfill completed:');
  console.log(`   Updated profiles: ${updated}`);
  console.log(`   Skipped (no plan mainGoals): ${skippedNoGoals}`);
  console.log(`   Skipped (already had mainGoals in medicalMarkers): ${skippedHasMarkers}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});

