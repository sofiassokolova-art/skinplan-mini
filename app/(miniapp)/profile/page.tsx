// app/(miniapp)/profile/page.tsx
// Страница профиля пользователя

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

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
  sensitivityLevel: string;
  acneLevel: string;
  notes?: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, initData, initialize } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Инициализируем Telegram WebApp
    initialize();
    
    // Проверяем доступность Telegram WebApp (как на других страницах)
    const waitForTelegram = (): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        // Если уже доступен
        if (window.Telegram?.WebApp?.initData) {
          resolve();
          return;
        }

        // Ждем максимум 2 секунды
        let attempts = 0;
        const maxAttempts = 20; // 20 * 100ms = 2 секунды

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
      
      // Проверяем доступность Telegram WebApp после ожидания
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
      
      // Загружаем данные пользователя из Telegram
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

      // Загружаем профиль кожи
      try {
        const profile = await api.getCurrentProfile();
        setSkinProfile(profile as SkinProfile);
      } catch (err: any) {
        // Профиль может быть не создан - это нормально
        if (!err?.message?.includes('No profile found') && !err?.message?.includes('404')) {
          console.warn('Ошибка загрузки профиля кожи:', err);
        }
      }
    } catch (err: any) {
      console.error('Ошибка загрузки профиля:', err);
      setError(err?.message || 'Ошибка загрузки профиля');
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
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
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
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '400px',
        }}>
          <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка</h1>
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
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const fullName = userProfile 
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.username || 'Пользователь'
    : 'Пользователь';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          backgroundColor: '#0A5F59',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          fontWeight: 'bold',
          margin: '0 auto 16px',
        }}>
          {fullName.charAt(0).toUpperCase()}
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          {fullName}
        </h1>
        {userProfile?.username && (
          <div style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '16px',
          }}>
            @{userProfile.username}
          </div>
        )}
      </div>

      {/* Profile Info Section */}
      <div style={{
        padding: '0 20px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {/* Помощь */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
          }}>
            Помощь
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <button
              onClick={() => router.push('/quiz')}
              style={{
                padding: '16px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                borderRadius: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#0A5F59', fontWeight: '500' }}>
                Пройти анкету заново
              </span>
              <span style={{ color: '#475467' }}>→</span>
            </button>
            
            <button
              onClick={() => window.open('https://t.me/skinplanned_bot', '_blank')}
              style={{
                padding: '16px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                borderRadius: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#0A5F59', fontWeight: '500' }}>
                Связаться с поддержкой
              </span>
              <span style={{ color: '#475467' }}>→</span>
            </button>
            
            <button
              onClick={() => router.push('/plan')}
              style={{
                padding: '16px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                borderRadius: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#0A5F59', fontWeight: '500' }}>
                Мой план ухода
              </span>
              <span style={{ color: '#475467' }}>→</span>
            </button>
          </div>
        </div>

        {/* О приложении */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
          }}>
            О приложении
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            color: '#475467',
            lineHeight: '1.6',
          }}>
            <p>
              <strong style={{ color: '#0A5F59' }}>SkinIQ</strong> — ваш персональный помощник по уходу за кожей.
            </p>
            <p>
              Мы создаем индивидуальные планы ухода на основе анализа вашей кожи и рекомендаций экспертов-дерматологов.
            </p>
            <div style={{
              marginTop: '8px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(10, 95, 89, 0.1)',
            }}>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                Версия 1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* О разработчике */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
          }}>
            О разработчике
          </h2>
          
          <div style={{
            color: '#475467',
            lineHeight: '1.6',
          }}>
            <p style={{ marginBottom: '12px' }}>
              Приложение разработано командой SkinIQ с любовью к вашей коже.
            </p>
            <p style={{ marginBottom: '12px' }}>
              Мы используем современные технологии и рекомендации экспертов для создания персонализированных планов ухода.
            </p>
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(10, 95, 89, 0.1)',
            }}>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                Все права защищены © 2025 SkinIQ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

