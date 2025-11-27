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
  // Получаем initData из headers (Telegram Mini App передает его так)
  const headersList = await headers();
  const initData = headersList.get('x-telegram-init-data') || 
                   headersList.get('X-Telegram-Init-Data') ||
                   null;

  if (!initData) {
    throw new Error('Не авторизован. Откройте приложение через Telegram Mini App.');
  }

  // Получаем userId из initData
  const userId = await getUserIdFromInitData(initData);
  
  if (!userId) {
    throw new Error('Не удалось определить пользователя');
  }

  // Получаем пользователя из БД
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  // Вызываем API endpoint для генерации плана (Server Component может делать fetch)
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  const planResponse = await fetch(`${baseUrl}/api/plan/generate`, {
    method: 'GET',
    headers: {
      'X-Telegram-Init-Data': initData,
    },
    cache: 'no-store',
  });

  if (!planResponse.ok) {
    throw new Error(`Failed to generate plan: ${planResponse.statusText}`);
  }

  const planData = await planResponse.json();
  const plan = planData;

  // Вычисляем skin scores - используем поля из профиля
  const questionnaireAnswers = {
    skinType: profile.skinType || 'normal',
    age: profile.ageGroup || '25-34',
    ageGroup: profile.ageGroup || '25-34',
    concerns: [], // concerns хранятся в ответах пользователя, не в профиле
    diagnoses: [],
    allergies: [],
    seasonChange: undefined,
    habits: [],
    retinolReaction: undefined,
    pregnant: profile.hasPregnancy || false,
    spfFrequency: undefined,
    sunExposure: undefined,
    sensitivityLevel: profile.sensitivityLevel || 'low',
    acneLevel: profile.acneLevel || 0,
    pigmentationRisk: profile.pigmentationRisk || undefined,
  };
  
  const scores = calculateSkinAxes(questionnaireAnswers);

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
      weeks: (plan.weeks || []).map((week: any) => ({
        week: week.week,
        days: (week.days || []).map((day: any) => {
          // morning/evening могут быть массивами строк (шагов) или ID продуктов
          // products - объект { step: { id, name, brand, step } }
          const morningProductIds = Array.isArray(day.morning) 
            ? day.morning.map((stepOrId: any) => {
                // Если это строка (шаг), ищем продукт в day.products
                if (typeof stepOrId === 'string' && day.products?.[stepOrId]?.id) {
                  return day.products[stepOrId].id;
                }
                // Если уже ID
                return typeof stepOrId === 'number' ? stepOrId : stepOrId;
              }).filter((id: any) => id)
            : [];
          
          const eveningProductIds = Array.isArray(day.evening)
            ? day.evening.map((stepOrId: any) => {
                if (typeof stepOrId === 'string' && day.products?.[stepOrId]?.id) {
                  return day.products[stepOrId].id;
                }
                return typeof stepOrId === 'number' ? stepOrId : stepOrId;
              }).filter((id: any) => id)
            : [];

          return {
            morning: morningProductIds,
            evening: eveningProductIds,
          };
        }),
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
