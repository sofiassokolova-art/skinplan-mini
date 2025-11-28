// app/(miniapp)/profile/page.tsx
// Личный кабинет пользователя

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { TelegramUserAvatar } from '@/components/TelegramUserAvatar';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  phoneNumber?: string;
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
  const { user, initialize, tg } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({});
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState(false);

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
      
      // Загружаем данные пользователя из БД (приоритет - данные из БД, так как они могут быть отредактированы)
      let dbUser: any = null;
      try {
        dbUser = await api.getUserProfile() as any;
      } catch (err) {
        console.warn('Could not load user profile from DB:', err);
      }

      // Данные пользователя: сначала из БД, если нет - из Telegram
      if (dbUser) {
        const profile: UserProfile = {
          id: dbUser.id || user?.id?.toString() || '',
          telegramId: dbUser.telegramId || user?.id?.toString() || '',
          username: dbUser.username || user?.username,
          firstName: dbUser.firstName || user?.first_name || undefined,
          lastName: dbUser.lastName || user?.last_name || undefined,
          language: dbUser.language || user?.language_code,
          phoneNumber: dbUser.phoneNumber || undefined,
        };
        setUserProfile(profile);
        setNameValue([dbUser.firstName || user?.first_name, dbUser.lastName || user?.last_name].filter(Boolean).join(' ') || '');
        setPhoneValue(dbUser.phoneNumber || '');
      } else if (user) {
        // Если БД недоступна, используем данные из Telegram
        const profile: UserProfile = {
          id: user.id.toString(),
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name || undefined,
          lastName: user.last_name || undefined,
          language: user.language_code,
          phoneNumber: undefined,
        };
        setUserProfile(profile);
        setNameValue([user.first_name, user.last_name].filter(Boolean).join(' ') || '');
        setPhoneValue('');
      }

      // Профиль кожи
      try {
        const profile = await api.getCurrentProfile() as SkinProfile;
        setSkinProfile(profile);
        
        // Пробуем загрузить план для вычисления текущего дня
        try {
          const plan = await api.getPlan() as any;
          if (plan?.weeks) {
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

  const handleSaveName = async () => {
    try {
      const parts = nameValue.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      
      await api.updateUserProfile({
        firstName,
        lastName,
      });
      
      setUserProfile(prev => prev ? {
        ...prev,
        firstName,
        lastName,
      } : null);
      
      setEditingName(false);
      toast.success('Имя обновлено');
    } catch (err: any) {
      console.error('Error saving name:', err);
      toast.error('Ошибка сохранения имени');
    }
  };

  const handleSavePhone = async () => {
    try {
      await api.updateUserProfile({
        phoneNumber: phoneValue.trim(),
      });
      
      setUserProfile(prev => prev ? {
        ...prev,
        phoneNumber: phoneValue.trim(),
      } : null);
      
      setEditingPhone(false);
      toast.success('Номер телефона обновлен');
    } catch (err: any) {
      console.error('Error saving phone:', err);
      toast.error('Ошибка сохранения номера телефона');
    }
  };

  const handleOpenSupport = () => {
    // Открываем чат с ботом через Telegram
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'skiniq_bot';
    const supportUrl = `https://t.me/${botUsername}`;
    
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(supportUrl);
    } else if (tg?.openLink) {
      tg.openLink(supportUrl);
    } else {
      window.open(supportUrl, '_blank');
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

  // Вычисляем статистику
  const daysInApp = skinProfile 
    ? Math.floor((new Date().getTime() - new Date(skinProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const completedDays = planInfo.currentDay || 0;

  // Получаем фото пользователя из Telegram
  const userPhotoUrl = user?.photo_url || (tg?.initDataUnsafe?.user?.photo_url);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      paddingBottom: '120px',
    }}>
      {/* Логотип */}
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
      </div>

      {/* Шапка с аватаркой и именем */}
      <div style={{
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        paddingTop: '48px',
        paddingBottom: '40px',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Аватар пользователя из Telegram */}
          {userPhotoUrl ? (
            <img
              src={userPhotoUrl}
              alt={fullName}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid rgba(10, 95, 89, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
            />
          ) : (
          <TelegramUserAvatar user={user || undefined} size="lg" />
          )}
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '4px',
              color: '#0A5F59',
            }}>
              {fullName}
              {userProfile?.username && (
                <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: 'normal' }}> @{userProfile.username}</span>
              )}
            </h1>
            <p style={{ fontSize: '14px', color: '#475467' }}>Ваш личный кабинет SkinIQ</p>
          </div>
        </div>
      </div>

      {/* Основные карточки */}
      <div style={{ padding: '20px', marginTop: '0' }}>
        {/* Редактируемые поля: Имя и Телефон */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
            Личные данные
          </h3>
          
          {/* Имя */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px', display: 'block' }}>
              Имя
            </label>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #D1D5DB',
                    fontSize: '16px',
                  }}
                  placeholder="Введите имя"
                />
                <button
                  onClick={handleSaveName}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameValue([userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || '');
                  }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '16px', color: '#1F2937' }}>
                  {nameValue || 'Не указано'}
                </span>
                <button
                  onClick={() => setEditingName(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F3F4F6',
                    color: '#0A5F59',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Редактировать
                </button>
              </div>
            )}
          </div>

          {/* Номер телефона */}
          <div>
            <label style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px', display: 'block' }}>
              Номер телефона
            </label>
            {editingPhone ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #D1D5DB',
                    fontSize: '16px',
                  }}
                  placeholder="+7 (999) 123-45-67"
                />
                <button
                  onClick={handleSavePhone}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setEditingPhone(false);
                    setPhoneValue(userProfile?.phoneNumber || '');
                  }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '16px', color: '#1F2937' }}>
                  {phoneValue || 'Не указано'}
                </span>
                <button
                  onClick={() => setEditingPhone(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F3F4F6',
                    color: '#0A5F59',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Редактировать
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Профиль кожи */}
        <Link
          href="/profile/skin"
          style={{
            display: 'block',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(10, 95, 89, 0.1)',
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
        </Link>

        {/* 28-дневный план */}
        <Link
          href="/plan"
          style={{
            display: 'block',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(10, 95, 89, 0.1)',
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
        </Link>

        {/* SkinIQ FAQ */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <button
            onClick={() => {
              if (expandedFAQ) {
                setExpandedFAQ(false);
              } else {
                router.push('/faq');
              }
            }}
                style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                SkinIQ FAQ
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                Часто задаваемые вопросы
              </p>
            </div>
            <div style={{ fontSize: '24px', color: '#0A5F59' }}>→</div>
          </button>
        </div>

        {/* Поддержка */}
        <button
          onClick={handleOpenSupport}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(10, 95, 89, 0.1)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
              Поддержка
            </h3>
            <p style={{ fontSize: '14px', color: '#6B7280' }}>
              Чат с ботом
            </p>
          </div>
          <div style={{ fontSize: '24px', color: '#0A5F59' }}>→</div>
        </button>

        {/* Пользовательские соглашения */}
        <Link
          href="/terms"
          style={{
            display: 'block',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(10, 95, 89, 0.1)',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                Пользовательские соглашения
              </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                Условия использования
              </p>
            </div>
            <div style={{ fontSize: '24px', color: '#0A5F59' }}>→</div>
          </div>
        </Link>

        {/* Версия приложения */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
                Версия приложения
          </h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                {process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
              </p>
            </div>
          </div>
        </div>

        {/* О разработчике */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '12px' }}>
            О разработчике
          </h3>
          <div style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '8px' }}>
              <strong>ИП Биктимирова</strong>
            </p>
            <p style={{ marginBottom: '4px' }}>
              Разработчик приложения SkinIQ
            </p>
        </div>
        </div>
      </div>
    </div>
  );
}
