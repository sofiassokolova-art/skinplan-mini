// app/(miniapp)/profile/page.tsx
// Личный кабинет пользователя

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { TelegramUserAvatar } from '@/components/TelegramUserAvatar';

interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
}

interface SkinProfile {
  skinType: string;
  sensitivityLevel?: string;
  acneLevel?: number;
  notes?: string;
  createdAt: string;
}

interface PlanInfo {
  currentDay?: number;
  totalDays?: number;
  started?: boolean;
}

export default function PersonalCabinet() {
  const router = useRouter();
  const { user, initialize } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initialize();
    
    const waitForTelegram = (): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }
        if (window.Telegram?.WebApp?.initData) {
          resolve();
          return;
        }
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.Telegram?.WebApp?.initData || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    };

    const init = async () => {
      await waitForTelegram();
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        setError('Откройте приложение через Telegram Mini App');
        setLoading(false);
        return;
      }
      loadProfile();
    };

    init();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Данные пользователя из Telegram
      if (user) {
        setUserProfile({
          id: user.id.toString(),
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          language: user.language_code,
        });
      }

      // Профиль кожи
      try {
        const profile = await api.getCurrentProfile() as SkinProfile;
        setSkinProfile(profile);
        
        // Пробуем загрузить план для вычисления текущего дня
        try {
          const plan = await api.getPlan() as any;
          if (plan?.weeks) {
            // Вычисляем текущий день (упрощенная логика - можно улучшить)
            const createdAt = new Date(profile.createdAt || Date.now());
            const now = new Date();
            const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const currentDay = Math.min(daysDiff + 1, 28);
            
            setPlanInfo({
              currentDay: currentDay > 0 ? currentDay : 1,
              totalDays: 28,
              started: true,
            });
          }
        } catch (planErr) {
          // План может быть не создан - это нормально
          console.log('Plan not loaded:', planErr);
        }
      } catch (err: any) {
        if (!err?.message?.includes('No profile found') && !err?.message?.includes('404')) {
          console.warn('Ошибка загрузки профиля:', err);
        }
      }
    } catch (err: any) {
      console.error('Ошибка загрузки:', err);
      setError(err?.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(to bottom right, #9333EA 0%, #EC4899 100%)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(255, 255, 255, 0.2)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error && !userProfile) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(to bottom right, #9333EA 0%, #EC4899 100%)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '400px',
        }}>
          <h1 style={{ color: '#1F2937', marginBottom: '16px' }}>Ошибка</h1>
          <p style={{ color: '#6B7280', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#9333EA',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const fullName = userProfile 
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.username || 'Пользователь'
    : 'Пользователь';

  // Вычисляем статистику
  const daysInApp = skinProfile 
    ? Math.floor((new Date().getTime() - new Date(skinProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const completedDays = planInfo.currentDay || 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'white',
      paddingBottom: '120px',
    }}>
      {/* Шапка с аватаркой и именем */}
      <div style={{
        background: 'linear-gradient(to bottom right, #9333EA 0%, #EC4899 100%)',
        paddingTop: '48px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <TelegramUserAvatar user={user || undefined} size="lg" />
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '4px',
            }}>
              {fullName}
              {userProfile?.username && (
                <span style={{ fontSize: '16px', opacity: 0.7 }}> @{userProfile.username}</span>
              )}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Ваш личный кабинет SkinIQ</p>
          </div>
        </div>
      </div>

      {/* Основные карточки */}
      <div style={{ padding: '16px', marginTop: '-48px' }}>
        {/* Профиль кожи */}
        <Link
          href="/profile/skin"
          style={{
            display: 'block',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #F3F4F6',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                Профиль кожи
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                {skinProfile?.skinType 
                  ? `${skinProfile.skinType === 'oily' ? 'Жирная' : skinProfile.skinType === 'dry' ? 'Сухая' : skinProfile.skinType === 'combo' ? 'Комбинированная' : 'Нормальная'}${skinProfile.acneLevel ? ` • Акне ${skinProfile.acneLevel} степени` : ''}`
                  : 'Пройдите анкету для анализа'}
              </p>
            </div>
            <div style={{ fontSize: '32px' }}>{skinProfile ? '→' : '✨'}</div>
          </div>
          {skinProfile && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
              {skinProfile.skinType && (
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}>
                  {skinProfile.skinType === 'oily' ? 'Жирная' : skinProfile.skinType === 'dry' ? 'Сухая' : skinProfile.skinType === 'combo' ? 'Комбинированная' : 'Нормальная'}
                </span>
              )}
              {skinProfile.acneLevel && skinProfile.acneLevel > 0 && (
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: '#FED7AA',
                  color: '#9A3412',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}>
                  Акне
                </span>
              )}
              {skinProfile.sensitivityLevel === 'high' && (
                <span style={{
                  padding: '4px 12px',
                  backgroundColor: '#DBEAFE',
                  color: '#1E40AF',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '500',
                }}>
                  Чувствительная
                </span>
              )}
            </div>
          )}
        </Link>

        {/* 28-дневный план */}
        <Link
          href="/plan"
          style={{
            display: 'block',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #F3F4F6',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                Ваш план на 28 дней
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                {planInfo.started && planInfo.currentDay
                  ? `День ${planInfo.currentDay} из 28 • Активен`
                  : 'План ещё не начат'}
              </p>
            </div>
            <div style={{ fontSize: '32px' }}>{planInfo.started ? '✅' : '📅'}</div>
          </div>
          {planInfo.started && planInfo.currentDay && (
            <div style={{ marginTop: '16px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '9999px', height: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(to right, #9333EA 0%, #EC4899 100%)',
                  height: '12px',
                  borderRadius: '9999px',
                  width: `${Math.min((planInfo.currentDay / 28) * 100, 100)}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </Link>

        {/* Кнопка перепройти анкету */}
        <Link
          href="/quiz"
          style={{
            display: 'block',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #F3F4F6',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                Перепройти анкету
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                Обновить данные о вашей коже для новых рекомендаций
              </p>
            </div>
            <div style={{ fontSize: '32px' }}>🔄</div>
          </div>
        </Link>

        {/* Статистика */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #F3F4F6',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
            Ваша статистика
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9333EA' }}>{daysInApp || 0}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Дней с SkinIQ</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981' }}>{completedDays}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Дней ухода выполнено</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#EC4899' }}>97%</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Доверие к рекомендациям</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#F59E0B' }}>4.9</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Оценка плана</div>
            </div>
          </div>
        </div>

        {/* Настройки и поддержка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
          <Link
            href="/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '16px 24px',
              textDecoration: 'none',
              color: '#1F2937',
              fontWeight: '500',
            }}
          >
            <span>Настройки</span>
            <span>→</span>
          </Link>
          <Link
            href="/support"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '16px 24px',
              textDecoration: 'none',
              color: '#1F2937',
              fontWeight: '500',
            }}
          >
            <span>Поддержка и чат с дерматологом</span>
            <span style={{ color: '#9333EA', fontWeight: 'bold' }}>24/7</span>
          </Link>
          <Link
            href="/invite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(to right, #9333EA 0%, #EC4899 100%)',
              color: 'white',
              borderRadius: '16px',
              padding: '20px 24px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Пригласить друга → +7 дней премиум
          </Link>
        </div>

        {/* Выход (скрытый) */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button
            onClick={() => {
              if (confirm('Вы уверены, что хотите выйти?')) {
                router.push('/');
              }
            }}
            style={{
              color: '#9CA3AF',
              fontSize: '14px',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
