// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей - Server Component

import { getUserPlanData, getProductsByIds } from '@/lib/plan-data';
import { PlanPageClient } from './plan-client';
import { notFound } from 'next/navigation';

export default async function PlanPage() {
  try {
    // 1. Получаем всё нужное за один запрос (Server Component!)
    const { 
      user, 
      profile,           // SkinProfile + scores (6 осей)
      plan,              // 4 недели × 7 дней × утро/вечер
      progress,          // { currentDay: 12, completedDays: [1,2,3...] }
      wishlist 
    } = await getUserPlanData();

    const currentDayGlobal = progress?.currentDay || 1;
    const currentWeek = Math.floor((currentDayGlobal - 1) / 7) + 1;
    const dayInWeek = ((currentDayGlobal - 1) % 7) || 1;

    // Получаем текущий день из плана
    const currentWeekData = plan.weeks.find(w => w.week === currentWeek);
    const currentDayData = currentWeekData?.days[dayInWeek - 1];

    const todayMorning = currentDayData?.morning || [];
    const todayEvening = currentDayData?.evening || [];

    // Получаем уникальные ID продуктов для текущего дня
    const todayProductIds = [...new Set([...todayMorning, ...todayEvening])].filter((id): id is number => typeof id === 'number');
    const products = await getProductsByIds(todayProductIds);

    // Передаем все данные в Client Component для интерактивности
    return (
      <PlanPageClient
        user={user}
        profile={profile}
        plan={plan}
        progress={progress}
        wishlist={wishlist}
        currentDay={currentDayGlobal}
        currentWeek={currentWeek}
        todayProducts={products}
        todayMorning={todayMorning}
        todayEvening={todayEvening}
      />
    );
  } catch (error: any) {
    console.error('Error loading plan page:', error);
    if (error?.message?.includes('not found') || error?.message?.includes('не найден')) {
      notFound();
    }
    throw error;
  }
}
