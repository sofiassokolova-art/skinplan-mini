// lib/plan-page/index.ts
// Оркестратор: одна функция buildPlanPageContext(userId) возвращает всё
// для страницы плана. Выполняет все необходимые запросы к БД и склейку.

import { prisma } from '@/lib/db';
import { getCurrentProfile } from '@/lib/get-current-profile';
import type { Plan28 } from '@/lib/plan-types';
import type { GoalKey } from '@/lib/concern-taxonomy';

import { calcSkinScore } from './skin-score';
import { buildProfileCards } from './profile-cards';
import { buildPhasesUI, buildHeroInfo } from './phase-content';
import { pickExpertNotes } from './expert-notes';
import {
  buildProductCards,
  collectAllReferencedProductIds,
} from './product-context';
import type { PlanPageContext } from './types';

export type { PlanPageContext } from './types';
export type { ProfileCard, ProductCard, PhaseUI, ExpertNote, SkinScoreInfo } from './types';

interface BuildOpts {
  /** Просрочен ли план (>28 дней) — приходит снаружи, чтобы не дублировать логику */
  planExpired?: boolean;
}

/**
 * Возвращает null, если у пользователя нет профиля или нет плана.
 */
export async function buildPlanPageContext(
  userId: string,
  opts: BuildOpts = {},
): Promise<PlanPageContext | null> {
  // 1. User + Profile
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    }),
    getCurrentProfile(userId),
  ]);

  if (!user || !profile) return null;

  // 2. Plan28
  const plan28Record = await prisma.plan28.findFirst({
    where: { userId, profileVersion: profile.version },
    orderBy: { createdAt: 'desc' },
    select: { planData: true },
  });
  const plan = plan28Record?.planData as Plan28 | null;
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) return null;

  // 3+4. PlanProgress + Cart + Wishlist + ProductReplacement — все зависят только
  // от userId и независимы друг от друга, поэтому одним Promise.all (на один
  // round-trip меньше). Стоят после проверки плана, чтобы не тратить запросы зря.
  const [progress, cartRows, wishlistRows, replacementRows] = await Promise.all([
    prisma.planProgress.findUnique({
      where: { userId },
      select: { currentDay: true, currentStreak: true },
    }),
    prisma.cart.findMany({ where: { userId }, select: { productId: true } }),
    prisma.wishlist.findMany({ where: { userId }, select: { productId: true } }),
    prisma.productReplacement.findMany({
      where: { userId },
      select: { oldProductId: true, newProductId: true },
    }),
  ]);
  const currentDay = clampDay(progress?.currentDay ?? 1);
  const currentStreak = progress?.currentStreak ?? 0;

  const cartProductIds = new Set(cartRows.map((r) => r.productId));
  const wishlistProductIds = new Set(wishlistRows.map((r) => r.productId));
  const replacements = new Map(
    replacementRows.map((r) => [r.oldProductId, r.newProductId]),
  );

  // 5. Подгружаем продукты одним запросом
  const productIds = collectAllReferencedProductIds(plan, replacements);
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          imageUrl: true,
          description: true,
          descriptionUser: true,
          brand: { select: { name: true } },
        },
      })
    : [];

  // 6. Сборка персонализированных блоков
  const mainGoals = (plan.mainGoals ?? []) as GoalKey[];

  const hero = buildHeroInfo(currentDay);
  const skinScore = calcSkinScore(profile);
  const profileCards = buildProfileCards(profile);
  const phases = buildPhasesUI(currentDay, mainGoals);
  const expertNotes = pickExpertNotes(currentDay, mainGoals);
  const productCards = buildProductCards({
    plan,
    products,
    cartProductIds,
    wishlistProductIds,
    replacements,
  });

  return {
    user: { firstName: user.firstName ?? '' },
    heading: buildHeading(user.firstName),
    hero,
    streak: {
      currentStreak,
      label: streakLabel(currentStreak),
    },
    skinScore,
    profileCards,
    phases,
    mainGoals,
    products: productCards,
    expertNotes,
    planExpired: opts.planExpired ?? false,
  };
}

// ─── helpers ───

function buildHeading(firstName: string | null | undefined): string {
  const name = (firstName ?? '').trim();
  if (!name) return 'Ваш персональный протокол ухода';
  return `${name}, ваш персональный протокол ухода`;
}

function streakLabel(streak: number): string {
  if (streak <= 0) return 'Пока нет отметок';
  if (streak === 1) return '1 день';
  // 2-4 — «дня», 5+ — «дней»
  const mod10 = streak % 10;
  const mod100 = streak % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${streak} дней подряд`;
  if (mod10 === 1) return `${streak} день подряд`;
  if (mod10 >= 2 && mod10 <= 4) return `${streak} дня подряд`;
  return `${streak} дней подряд`;
}

function clampDay(day: number): number {
  if (!Number.isFinite(day) || day < 1) return 1;
  if (day > 28) return 28;
  return Math.round(day);
}
