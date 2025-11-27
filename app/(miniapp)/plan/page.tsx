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
    
    // Более понятная обработка ошибок
    if (error?.message?.includes('not found') || error?.message?.includes('не найден')) {
      notFound();
    }
    
    // Если это ошибка авторизации - показываем сообщение
    if (error?.message?.includes('Не авторизован') || 
        error?.message?.includes('Не удалось определить пользователя')) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Откройте через Telegram
            </h2>
            <p style={{
              color: '#475467',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}>
              Для просмотра плана необходимо открыть приложение через Telegram Mini App.
            </p>
          </div>
        </div>
      );
    }
    
    // Если это ошибка отсутствия профиля - показываем сообщение
    if (error?.message?.includes('Skin profile not found') ||
        error?.message?.includes('User not found')) {
      // Возвращаем компонент с сообщением об ошибке вместо throw
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Профиль не найден
            </h2>
            <p style={{
              color: '#475467',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}>
              Для просмотра плана необходимо сначала пройти анкету.
            </p>
            <a
              href="/quiz"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                borderRadius: '12px',
                backgroundColor: '#0A5F59',
                color: 'white',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
              }}
            >
              Пройти анкету
            </a>
          </div>
        </div>
      );
    }
    
    // Для остальных ошибок - показываем общую страницу ошибки
    throw error;
  }
}
