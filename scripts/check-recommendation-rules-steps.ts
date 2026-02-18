// scripts/check-recommendation-rules-steps.ts
// Проверка правил рекомендаций: какие шаги (categories) заданы в stepsJson у каждого правила

import { prisma } from '../lib/db';

function getStepCategories(stepsJson: unknown): string[] {
  if (!stepsJson || typeof stepsJson !== 'object') return [];
  const steps = stepsJson as Record<string, unknown>;
  const categories: string[] = [];
  for (const stepConfig of Object.values(steps)) {
    if (stepConfig && typeof stepConfig === 'object' && 'category' in stepConfig) {
      const cat = (stepConfig as { category?: string[] }).category;
      if (Array.isArray(cat)) categories.push(...cat);
    }
    // Имя шага (ключ) тоже считается — например serum, treatment, mask без category
    // В getProductsForStep используется step.category, но ключ объекта = stepName
  }
  return [...new Set(categories)];
}

function getStepKeys(stepsJson: unknown): string[] {
  if (!stepsJson || typeof stepsJson !== 'object') return [];
  return Object.keys(stepsJson as object);
}

async function main() {
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    select: { id: true, name: true, priority: true, stepsJson: true },
  });

  console.log(`Всего активных правил: ${rules.length}\n`);

  const stepGroups = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'mask'] as const;
  const header = ['id', 'priority', 'name', ...stepGroups].map((h, i) =>
    i <= 2 ? h.padEnd(i === 2 ? 50 : 8) : h.padEnd(12)
  );
  console.log(header.join(' │ '));
  console.log('─'.repeat(120));

  let missingSerum = 0;
  let missingTreatment = 0;
  let missingMask = 0;

  for (const r of rules) {
    const stepsJson = r.stepsJson as Record<string, { category?: string[] }> | null;
    const keys = getStepKeys(stepsJson);
    const categories = getStepCategories(stepsJson);

    const hasStep = (group: string) => {
      const keyMatch = keys.some((k) => k.toLowerCase() === group);
      const catMatch = categories.some(
        (c) => c.toLowerCase() === group || c.toLowerCase().startsWith(group + '_')
      );
      return keyMatch || catMatch;
    };

    if (!hasStep('serum')) missingSerum++;
    if (!hasStep('treatment')) missingTreatment++;
    if (!hasStep('mask')) missingMask++;

    const nameShort = (r.name || '').length > 48 ? (r.name || '').slice(0, 47) + '…' : (r.name || '');
    const cells = [
      String(r.id).padEnd(8),
      String(r.priority).padEnd(8),
      nameShort.padEnd(50),
      ...stepGroups.map((g) => (hasStep(g) ? '✓' : '—').padEnd(12)),
    ];
    console.log(cells.join(' │ '));
  }

  console.log('');
  console.log('Итог по шагам (сколько правил НЕ содержат шаг):');
  console.log('  serum:    ', missingSerum, 'правил без serum');
  console.log('  treatment:', missingTreatment, 'правил без treatment');
  console.log('  mask:     ', missingMask, 'правил без mask');

  // Детально: вывести stepsJson для правил, у которых нет serum/treatment/mask
  const incomplete = rules.filter((r) => {
    const keys = getStepKeys(r.stepsJson);
    const has = (g: string) => keys.some((k) => k.toLowerCase() === g);
    return !has('serum') || !has('treatment') || !has('mask');
  });

  if (incomplete.length > 0 && incomplete.length <= 15) {
    console.log('\nПравила без serum/treatment/mask (ключи stepsJson):');
    for (const r of incomplete) {
      const keys = getStepKeys(r.stepsJson);
      console.log(`  id=${r.id} "${r.name?.slice(0, 40)}..." → шаги: [${keys.join(', ')}]`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
