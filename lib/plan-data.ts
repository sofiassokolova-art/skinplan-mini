// lib/plan-data.ts
// Server-side функции для получения данных плана

import { headers } from 'next/headers';
import { validateTelegramInitData } from './telegram';
import { prisma } from './db';
import { calculateSkinAxes } from './skin-analysis-engine';
import { getUserIdFromInitData } from './get-user-from-initdata';

interface PlanData {
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
  };
  profile: {
    id: string;
    skinType: string;
    skinTypeRu: string;
    primaryConcernRu: string;
    sensitivityLevel: string | null;
    acneLevel: number | null;
    scores: any; // SkinScore[]
  };
  plan: {
    weeks: Array<{
      week: number;
      days: Array<{
        morning: number[];
        evening: number[];
      }>;
    }>;
  };
  progress: {
    currentDay: number;
    completedDays: number[];
  };
  wishlist: number[];
}

/**
 * Получает все данные для страницы плана за один запрос
 */
export async function getUserPlanData(): Promise<PlanData> {
  const cookieStore = await cookies();
  const initData = cookieStore.get('telegram_init_data')?.value || 
    (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null);

  if (!initData) {
    throw new Error('Не авторизован');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('Bot token not configured');
  }

  // Валидируем initData
  const validation = validateTelegramInitData(initData, botToken);
  if (!validation.valid || !validation.data?.user) {
    throw new Error('Invalid initData');
  }

  const { user: tgUser } = validation.data;

  // Получаем пользователя из БД
  const user = await prisma.user.findUnique({
    where: { telegramId: tgUser.id.toString() },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Получаем профиль кожи
  const profile = await prisma.skinProfile.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!profile) {
    throw new Error('Skin profile not found');
  }

  // Получаем план (генерируем или берем из кэша)
  const planResponse = await generatePlan({ userId: user.id });
  const plan = planResponse.plan;

  // Вычисляем skin scores
  const scores = calculateSkinAxes(profile);

  // Получаем прогресс из localStorage (через API)
  // TODO: Сохранять прогресс в БД
  const progress = {
    currentDay: 1,
    completedDays: [] as number[],
  };

  // Получаем wishlist
  const wishlistItems = await prisma.wishlist.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  const wishlist = wishlistItems.map(item => item.productId);

  // Преобразуем тип кожи в русский
  const skinTypeRuMap: Record<string, string> = {
    dry: 'Сухая',
    oily: 'Жирная',
    combo: 'Комбинированная',
    normal: 'Нормальная',
    sensitive: 'Чувствительная',
  };

  // Определяем primary concern (из concerns в profile или из scores)
  const primaryConcernRu = 'Акне'; // TODO: Вычислить из профиля

  return {
    user: {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    profile: {
      id: profile.id,
      skinType: profile.skinType || 'normal',
      skinTypeRu: skinTypeRuMap[profile.skinType || 'normal'] || 'Нормальная',
      primaryConcernRu,
      sensitivityLevel: profile.sensitivityLevel || null,
      acneLevel: profile.acneLevel || null,
      scores,
    },
    plan: {
      weeks: plan.weeks.map((week: any) => ({
        week: week.week,
        days: week.days.map((day: any) => ({
          morning: day.morning || [],
          evening: day.evening || [],
        })),
      })),
    },
    progress,
    wishlist,
  };
}

/**
 * Получает детали продуктов по их ID
 */
export async function getProductsByIds(productIds: number[]) {
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      published: true,
    },
    include: {
      brand: true,
    },
  });

  return products.map(p => ({
    id: p.id,
    name: p.name,
    brand: {
      id: p.brand.id,
      name: p.brand.name,
    },
    price: p.price || 0,
    volume: p.volume || null,
    imageUrl: p.imageUrl || null,
    step: p.step,
    firstIntroducedDay: 1, // TODO: Вычислить из плана
  }));
}
