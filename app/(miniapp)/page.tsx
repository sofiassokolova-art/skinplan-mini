// app/(miniapp)/page.tsx
// Главная страница мини-аппа (рутина ухода) - миграция из Home.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

interface RoutineItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  howto: {
    steps: string[];
    volume: string;
    tip: string;
  };
  done: boolean;
}

interface Recommendation {
  profile_summary: {
    skinType: string;
    sensitivityLevel: string;
    notes: string;
  };
  steps: Record<string, Array<{
    id: number;
    name: string;
    brand: string;
    description: string;
    imageUrl?: string;
  }>>;
}

const ICONS: Record<string, string> = {
  cleanser: '/icons/cleanser1.PNG',
  toner: '/icons/toner1.PNG',
  serum: '/icons/serum.PNG',
  cream: '/icons/cream.PNG',
  spf: '/icons/spf1.PNG',
  acid: '/icons/acid1.PNG',
};

export default function HomePage() {
  const router = useRouter();
  const { initialize, isAvailable } = useTelegram();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [tab, setTab] = useState<'AM' | 'PM'>('AM');
  const [selectedItem, setSelectedItem] = useState<RoutineItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    initialize();
    
    // Загружаем данные (пользователь идентифицируется автоматически через initData)
    const initAndLoad = async () => {
      // Проверяем, что приложение открыто через Telegram
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        console.log('Telegram WebApp не доступен, перенаправляем на анкету');
        router.push('/quiz');
        return;
      }

      // Загружаем рекомендации (initData передается автоматически в запросе)
      await loadRecommendations();
    };

    initAndLoad();
  }, [router]);

  const loadRecommendations = async () => {
    try {
      const data = await api.getRecommendations() as Recommendation;
      setRecommendations(data);
      
      // Преобразуем рекомендации в RoutineItem[]
      const items: RoutineItem[] = [];
      
      // Утренняя рутина
      if (data?.steps?.cleanser) {
        items.push({
          id: 'cleanser',
          title: 'Очищение',
          subtitle: data.steps.cleanser[0]?.name || 'Очищающее средство',
          icon: ICONS.cleanser,
          howto: {
            steps: ['Смочите лицо тёплой водой', 'Нанесите средство', 'Массируйте 30–40 сек', 'Смойте'],
            volume: '1–2 дозы',
            tip: 'Используйте тёплую воду',
          },
          done: false,
        });
      }
      
      if (data?.steps?.toner) {
        items.push({
          id: 'toner',
          title: 'Тонер',
          subtitle: data.steps.toner[0]?.name || 'Тоник',
          icon: ICONS.toner,
          howto: {
            steps: ['Нанесите на руки', 'Распределите похлопывающими движениями'],
            volume: '3–5 капель',
            tip: 'Избегайте ватных дисков',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment) {
        items.push({
          id: 'active',
          title: 'Актив',
          subtitle: data.steps.treatment[0]?.name || 'Активное средство',
          icon: ICONS.serum,
          howto: {
            steps: ['1–2 пипетки на кожу', 'Нанесите равномерно'],
            volume: '4–6 капель',
            tip: 'Подождите 1–2 минуты до крема',
          },
          done: false,
        });
      }
      
      if (data?.steps?.moisturizer) {
        items.push({
          id: 'cream',
          title: 'Крем',
          subtitle: data.steps.moisturizer[0]?.name || 'Увлажняющий крем',
          icon: ICONS.cream,
          howto: {
            steps: ['Горох крема распределить по лицу', 'Мягко втереть'],
            volume: 'Горошина',
            tip: 'Не забывайте шею',
          },
          done: false,
        });
      }
      
      if (data?.steps?.spf) {
        items.push({
          id: 'spf',
          title: 'SPF-защита',
          subtitle: data.steps.spf[0]?.name || 'SPF 50',
          icon: ICONS.spf,
          howto: {
            steps: ['Нанести 2 пальца SPF', 'Обновлять каждые 2–3 часа'],
            volume: '~1.5–2 мл',
            tip: 'Обязательно при UV > 3',
          },
          done: false,
        });
      }
      
      setRoutineItems(items);
    } catch (error: any) {
      console.error('Error loading recommendations:', error);
      
      // Проверяем тип ошибки
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('401') || error?.message?.includes('initData')) {
        // Ошибка идентификации - перенаправляем на анкету
        router.push('/quiz');
        return;
      }
      
      if (error?.message?.includes('404') || error?.message?.includes('No skin profile')) {
        // Профиль не найден - перенаправляем на анкету
        console.log('Профиль не найден, перенаправляем на анкету');
        router.push('/quiz');
        return;
      }
      
      // Другие ошибки - показываем сообщение
      setError(error?.message || 'Ошибка загрузки рекомендаций');
      setRoutineItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setRoutineItems((items) =>
      items.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      )
    );
  };

  if (!mounted || loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка плана...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error && routineItems.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка загрузки</h1>
        <p style={{ color: '#475467', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => router.push('/quiz')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          Пройти анкету заново
        </button>
      </div>
    );
  }

  if (routineItems.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Нет рекомендаций</h1>
        <p>Пройдите анкету, чтобы получить персональные рекомендации</p>
        <button
          onClick={() => router.push('/quiz')}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Пройти анкету
        </button>
      </div>
    );
  }

  const completedCount = routineItems.filter((item) => item.done).length;
  const totalCount = routineItems.length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
      }}>
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '140px',
            marginTop: '8px',
            marginBottom: '8px',
          }}
        />
        <div style={{
          fontSize: '26px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '8px',
        }}>
          Время заботиться о своей коже
        </div>
        <button
          onClick={() => router.push('/plan')}
          style={{
            marginTop: '16px',
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          📅 28-дневный план →
        </button>
        {recommendations?.profile_summary && (
          <div style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '16px',
          }}>
            {completedCount}/{totalCount} шагов
          </div>
        )}
      </div>

      {/* Toggle AM/PM */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.42)',
          backdropFilter: 'blur(20px)',
          borderRadius: '28px',
          padding: '6px',
          display: 'flex',
          gap: '6px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}>
          <button
            onClick={() => setTab('AM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'AM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'AM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Утро
          </button>
          <button
            onClick={() => setTab('PM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'PM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'PM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Вечер
          </button>
        </div>
      </div>

      {/* Routine Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '0 20px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {routineItems.map((item, index) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.56)',
              backdropFilter: 'blur(28px)',
              borderRadius: '20px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              opacity: item.done ? 0.7 : 1,
            }}
          >
            {/* Step Number */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: item.done ? '#0A5F59' : 'rgba(10, 95, 89, 0.1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {item.done ? '✓' : index + 1}
            </div>

            {/* Icon */}
            <img
              src={item.icon}
              alt={item.title}
              style={{
                width: '60px',
                height: '60px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#0A5F59',
                marginBottom: '4px',
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#475467',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.subtitle}
              </div>
            </div>

            {/* Info Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItem(item);
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              i
            </button>
          </div>
        ))}
      </div>

      {/* BottomSheet для деталей */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedItem(null)}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '85vh',
              backgroundColor: 'rgba(250, 251, 253, 0.75)',
              backdropFilter: 'blur(32px)',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              padding: '24px',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '16px' }}>
              {selectedItem.title}
            </h3>
            <div style={{ marginBottom: '16px', color: '#475467' }}>
              {selectedItem.subtitle}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Как использовать:</h4>
              <ol style={{ paddingLeft: '20px' }}>
                {selectedItem.howto.steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: '8px', color: '#475467' }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div style={{ marginBottom: '16px', color: '#475467', fontSize: '14px' }}>
              <strong>Объём:</strong> {selectedItem.howto.volume}
            </div>
            <div style={{ color: '#0A5F59', fontSize: '14px', fontStyle: 'italic' }}>
              💡 {selectedItem.howto.tip}
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}