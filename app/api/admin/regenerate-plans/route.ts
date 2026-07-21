// app/api/admin/regenerate-plans/route.ts
// Массовая перегенерация 28-дневных планов по актуальным правилам (в т.ч. новый
// phase-safety фильтр `isProductAllowedInPlanPhase`). Запускается вручную/разово
// как обслуживающая операция.
//
// ВАЖНО: генерация обязана идти в прод-runtime, где доступен PII_ENCRYPTION_KEY —
// иначе `skin_profiles.medical_markers` не расшифруется и контра-флаги
// (аллергии/диагнозы) молча потеряются → небезопасные рекомендации. Локально
// (без ключа) НЕ запускать. См. reference: прод-БД из локальных скриптов.
//
// Авторизация — как у cron-роутов: Bearer CRON_SECRET или ?secret=.
// Триггерить: curl -X POST "https://<prod>/api/admin/regenerate-plans?secret=$CRON_SECRET"
// Опции:
//   ?dryRun=1   — только посчитать раскладку по фазам, план в БД НЕ писать.
//   ?userId=... — перегенерировать одного пользователя (для валидации перед всеми).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';
import { generate28DayPlan } from '@/lib/plan-generator';
import type { Plan28, PlanPhases } from '@/lib/plan-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PHASE_ORDER: Record<PlanPhases, number> = { adaptation: 0, active: 1, support: 2 };

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

// Раскладка средств по firstPhase — так же, как их группирует страница плана.
// Нужна, чтобы в ответе было видно, что новые правила реально применились.
function summarizePhases(plan: Plan28) {
  const productPhases = new Map<string, Set<PlanPhases>>();
  const dayCountByPhase: Record<PlanPhases, number> = { adaptation: 0, active: 0, support: 0 };
  for (const day of plan.days ?? []) {
    const phase = day.phase as PlanPhases;
    dayCountByPhase[phase] = (dayCountByPhase[phase] ?? 0) + 1;
    const steps = [...(day.morning ?? []), ...(day.evening ?? []), ...(day.weekly ?? [])];
    for (const s of steps) {
      if (!s.productId) continue;
      if (!productPhases.has(s.productId)) productPhases.set(s.productId, new Set());
      productPhases.get(s.productId)!.add(phase);
    }
  }
  const firstPhaseCount: Record<PlanPhases, number> = { adaptation: 0, active: 0, support: 0 };
  for (const phases of productPhases.values()) {
    const earliest = [...phases].sort((a, b) => PHASE_ORDER[a] - PHASE_ORDER[b])[0];
    firstPhaseCount[earliest] += 1;
  }
  return { dayCountByPhase, newProductsByPhase: firstPhaseCount, totalProducts: productPhases.size };
}

async function handle(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';
  const singleUserId = searchParams.get('userId');

  // Целевые пользователи: конкретный userId либо все, у кого уже есть план.
  const userIds = singleUserId
    ? [singleUserId]
    : (await prisma.plan28.findMany({
        distinct: ['userId'],
        select: { userId: true },
      })).map((r) => r.userId);

  logger.info('🔁 Bulk plan regeneration started', { count: userIds.length, dryRun, singleUserId });

  const results: Array<Record<string, unknown>> = [];
  let regenerated = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const profile = await prisma.skinProfile.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      if (!profile) {
        skipped += 1;
        results.push({ userId, status: 'skipped', reason: 'no_profile' });
        continue;
      }

      const generated = await generate28DayPlan(userId);
      const plan = generated?.plan28;
      if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
        failed += 1;
        results.push({ userId, status: 'failed', reason: 'empty_plan' });
        continue;
      }

      const summary = summarizePhases(plan);

      if (!dryRun) {
        await prisma.plan28.upsert({
          where: { userId_profileVersion: { userId, profileVersion: profile.version } },
          update: { planData: plan as unknown as object, updatedAt: new Date() },
          create: {
            userId,
            skinProfileId: profile.id,
            profileVersion: profile.version,
            planData: plan as unknown as object,
          },
        });
      }

      regenerated += 1;
      results.push({ userId, status: dryRun ? 'dry_run' : 'regenerated', profileVersion: profile.version, ...summary });
    } catch (err: any) {
      failed += 1;
      logger.error('Bulk regen failed for user', err, { userId });
      results.push({ userId, status: 'failed', reason: err?.message || 'unknown' });
    }
  }

  logger.info('✅ Bulk plan regeneration finished', { regenerated, failed, skipped, dryRun });

  return NextResponse.json({
    ok: true,
    dryRun,
    totals: { targeted: userIds.length, regenerated, failed, skipped },
    results,
  });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// GET для удобного ручного дёргания из браузера/сервиса (с ?secret=). Мутации
// защищены dryRun-параметром и авторизацией, но реальную запись рекомендуется
// делать через POST.
export async function GET(request: NextRequest) {
  return handle(request);
}
