// lib/plan-access.ts
// Shared server-side helpers for plan payment history and active access.

import { prisma } from '@/lib/db';

export interface PlanAccessState {
  /** User has ever received paid_access, even if it is already expired. */
  hasPaidBefore: boolean;
  /** paid_access is active right now and still within validUntil. */
  hasActivePaidAccess: boolean;
  paidAccessValidUntil: string | null;
}

export function isPaidAccessActive(
  entitlement: { active: boolean; validUntil: Date | null } | null | undefined,
  now = new Date(),
): boolean {
  return entitlement?.active === true && (!entitlement.validUntil || entitlement.validUntil > now);
}

export async function getPlanAccessState(userId: string, now = new Date()): Promise<PlanAccessState> {
  const paidAccess = await prisma.entitlement.findUnique({
    where: { userId_code: { userId, code: 'paid_access' } },
    select: {
      active: true,
      validUntil: true,
    },
  });

  return {
    hasPaidBefore: !!paidAccess,
    hasActivePaidAccess: isPaidAccessActive(paidAccess, now),
    paidAccessValidUntil: paidAccess?.validUntil?.toISOString() ?? null,
  };
}

export function attachPlanAccessState<T extends object>(
  payload: T,
  accessState: PlanAccessState,
): T & PlanAccessState {
  return {
    ...payload,
    ...accessState,
  };
}
