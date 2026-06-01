'use client';

import { getClientUserScope } from '@/lib/client-user-scope';

const PLAN_WARM_TTL_MS = 60_000;

interface PlanWarmCacheEntry<T> {
  data: T;
  planKey: string | null;
  scope: string;
  ts: number;
}

let planWarmCache: PlanWarmCacheEntry<unknown> | null = null;

export function readPlanWarmCache<T>(): PlanWarmCacheEntry<T> | null {
  const scope = getClientUserScope();
  if (!scope || !planWarmCache || planWarmCache.scope !== scope) return null;

  if (Date.now() - planWarmCache.ts > PLAN_WARM_TTL_MS) {
    planWarmCache = null;
    return null;
  }

  return planWarmCache as PlanWarmCacheEntry<T>;
}

export function writePlanWarmCache<T>(data: T, planKey?: string | null): void {
  const scope = getClientUserScope();
  if (!scope) return;

  planWarmCache = {
    data,
    planKey: planKey ?? null,
    scope,
    ts: Date.now(),
  };
}

export function invalidatePlanWarmCache(): void {
  planWarmCache = null;
}
