// app/api/plan/teaser/route.ts
// Тизер структуры плана ДО оплаты: только роли шагов (Очищение/Крем/SPF...) и
// число подобранных средств — без названий продуктов, брендов и конкретных
// рекомендаций. Показывается на пейволе, чтобы человек видел «предварительный
// результат» и понимал, за что платит. Пейвол это не обходит: полезной
// информации о продуктах здесь нет.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';
import type { Plan28, DayStep } from '@/lib/plan-types';

const BASE_STEP_LABELS: Record<string, string> = {
  cleanser: 'Очищение',
  toner: 'Тоник',
  serum: 'Сыворотка',
  treatment: 'Актив',
  spot_treatment: 'Актив',
  moisturizer: 'Крем',
  spf: 'SPF',
  lip_care: 'Уход за губами',
  mask: 'Маска',
  eye_cream: 'Крем для глаз',
  balm: 'Бальзам',
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  dry: 'сухой кожи',
  oily: 'жирной кожи',
  normal: 'нормальной кожи',
  combination_dry: 'комбинированной кожи',
  combination_oily: 'комбинированной кожи',
  combo: 'комбинированной кожи',
};

function stepLabels(steps: DayStep[] | undefined): string[] {
  const labels: string[] = [];
  for (const s of steps ?? []) {
    const base = getBaseStepFromStepCategory(String(s.stepCategory) as any);
    const label = BASE_STEP_LABELS[base] ?? null;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/teaser';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const profile = await getCurrentProfile(userId);
    if (!profile) {
      logApiRequest(method, path, 200, Date.now() - startTime, userId);
      return ApiResponse.success({ teaser: null });
    }

    const planRecord = await prisma.plan28.findFirst({
      where: { userId, profileVersion: profile.version },
      orderBy: { createdAt: 'desc' },
      select: { planData: true },
    });
    const plan = planRecord?.planData as Plan28 | null;
    if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
      logApiRequest(method, path, 200, Date.now() - startTime, userId);
      return ApiResponse.success({ teaser: null });
    }

    // Структуру показываем по «активной» фазе (середина плана) — там рутина полная.
    // Если вдруг день не найдётся, откатываемся на первый день.
    const midDay = plan.days.find((d) => d.dayIndex === 10) ?? plan.days[0];

    const productIds = new Set<string>();
    for (const day of plan.days) {
      for (const step of [...(day.morning ?? []), ...(day.evening ?? []), ...(day.weekly ?? [])]) {
        if (step.productId) productIds.add(String(step.productId));
      }
    }

    const teaser = {
      morning: stepLabels(midDay.morning),
      evening: stepLabels(midDay.evening),
      productsCount: productIds.size,
      skinTypeLabel: SKIN_TYPE_LABELS[String(profile.skinType || '').toLowerCase()] ?? null,
    };

    logApiRequest(method, path, 200, Date.now() - startTime, userId);
    return ApiResponse.success({ teaser });
  } catch (error) {
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path });
  }
}
