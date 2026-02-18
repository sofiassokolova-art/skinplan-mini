// scripts/check-all-sessions-steps.ts
// Проверка всех RecommendationSession: покрытие шагов (cleanser, toner, serum, treatment, moisturizer, spf, mask)

import { prisma } from '../lib/db';
import { mapStepToStepCategory } from '../lib/step-matching';

const STEP_GROUPS = {
  cleanser: (s: string) => s.startsWith('cleanser_'),
  toner: (s: string) => s.startsWith('toner_'),
  serum: (s: string) => s.startsWith('serum_'),
  treatment: (s: string) => s.startsWith('treatment_') || s.startsWith('spot_treatment'),
  moisturizer: (s: string) => s.startsWith('moisturizer_'),
  spf: (s: string) => s.startsWith('spf_'),
  mask: (s: string) => s.startsWith('mask_'),
} as const;

type GroupKey = keyof typeof STEP_GROUPS;

async function main() {
  const sessions = await prisma.recommendationSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, telegramId: true, firstName: true } },
      profile: { select: { skinType: true, version: true } },
    },
  });

  if (sessions.length === 0) {
    console.log('Нет сессий в БД');
    await prisma.$disconnect();
    return;
  }

  const allProductIds = new Set<number>();
  for (const s of sessions) {
    if (Array.isArray(s.products)) (s.products as number[]).forEach((id: number) => allProductIds.add(id));
  }

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(allProductIds) } },
    select: { id: true, step: true, category: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  console.log(`Всего сессий: ${sessions.length}`);
  console.log('');

  const rows: { id: number; user: string; count: number; covered: GroupKey[]; missing: GroupKey[] }[] = [];

  for (const session of sessions) {
    const productIds = (Array.isArray(session.products) ? session.products : []) as number[];
    const skinType = session.profile?.skinType ?? null;
    const stepSet = new Set<string>();

    for (const pid of productIds) {
      const p = productMap.get(pid);
      if (!p) continue;
      const mapped = mapStepToStepCategory(p.step, p.category, skinType ?? undefined);
      mapped.forEach((s) => stepSet.add(s));
    }

    const covered: GroupKey[] = [];
    const missing: GroupKey[] = [];
    for (const key of Object.keys(STEP_GROUPS) as GroupKey[]) {
      const has = [...stepSet].some(STEP_GROUPS[key]);
      if (has) covered.push(key);
      else missing.push(key);
    }

    const userLabel = session.user
      ? `${session.user.telegramId || session.userId} (${session.user.firstName || '—'})`
      : session.userId;
    rows.push({
      id: session.id,
      user: userLabel,
      count: productIds.length,
      covered,
      missing,
    });
  }

  // Таблица: id, user, products, cleanser, toner, serum, treatment, moisturizer, spf, mask
  const headers = ['id', 'user', 'N', 'cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'mask'];
  const colWidths = [6, 28, 4, 10, 8, 8, 12, 14, 6, 8];
  const line = colWidths.map((w) => '─'.repeat(w)).join('┬');

  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(' │ '));
  console.log(colWidths.map((w) => '─'.repeat(w)).join('─┼─'));

  for (const r of rows) {
    const cells = [
      String(r.id).padEnd(colWidths[0]),
      (r.user.length > 26 ? r.user.slice(0, 25) + '…' : r.user).padEnd(colWidths[1]),
      String(r.count).padEnd(colWidths[2]),
      (r.covered.includes('cleanser') ? '✓' : '—').padEnd(colWidths[3]),
      (r.covered.includes('toner') ? '✓' : '—').padEnd(colWidths[4]),
      (r.covered.includes('serum') ? '✓' : '—').padEnd(colWidths[5]),
      (r.covered.includes('treatment') ? '✓' : '—').padEnd(colWidths[6]),
      (r.covered.includes('moisturizer') ? '✓' : '—').padEnd(colWidths[7]),
      (r.covered.includes('spf') ? '✓' : '—').padEnd(colWidths[8]),
      (r.covered.includes('mask') ? '✓' : '—').padEnd(colWidths[9]),
    ];
    console.log(cells.join(' │ '));
  }

  const withMissing = rows.filter((r) => r.missing.length > 0);
  if (withMissing.length > 0) {
    console.log('');
    console.log(`Сессии с непокрытыми шагами: ${withMissing.length}`);
    for (const r of withMissing) {
      console.log(`  id=${r.id} (${r.user}, N=${r.count}): нет [${r.missing.join(', ')}]`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
