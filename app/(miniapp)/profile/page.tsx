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
import { clientLogger } from '@/lib/client-logger';

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
  const [expandedFAQ, setExpandedFAQ] = useState<number | false>(false);
  // ИСПРАВЛЕНО: Имя для отображения - приоритет из ответа USER_NAME
  const [displayNameFromAnswer, setDisplayNameFromAnswer] = useState<string | null>(null);

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
      // ИСПРАВЛЕНО: await loadProfile() для возможности "цеплять" последующие шаги без гонок
      await loadProfile();
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
      } catch (err: any) {
        // ИСПРАВЛЕНО: Не логируем 429 ошибки как warning (rate limiting)
        if (err?.status !== 429) {
          clientLogger.warn('Could not load user profile from DB:', err);
        }
      }

      // ИСПРАВЛЕНО: Имя должно браться из ответа пользователя на вопрос USER_NAME
      // Сначала пытаемся получить имя из ответов на вопрос USER_NAME
      let userNameFromAnswer: string | null = null;
      try {
        const userAnswersResponse = await api.getUserAnswers() as any;
        
        // ИСПРАВЛЕНО: Нормализуем формат ответа - API может возвращать массив напрямую или обернутый в объект
        // Добавлена валидация структуры для предотвращения скрытия реальных проблем API
        let userAnswers: any[] = [];
        
        // Проверяем, что ответ не является ошибкой
        if (userAnswersResponse && typeof userAnswersResponse === 'object' && 'error' in userAnswersResponse) {
          clientLogger.warn('⚠️ API вернул ошибку вместо ответов', userAnswersResponse);
          throw new Error('API returned error response');
        }
        
        if (Array.isArray(userAnswersResponse)) {
          userAnswers = userAnswersResponse;
        } else if (userAnswersResponse && typeof userAnswersResponse === 'object') {
          // Проверяем, есть ли поле data или items
          if (Array.isArray(userAnswersResponse.data)) {
            userAnswers = userAnswersResponse.data;
          } else if (Array.isArray(userAnswersResponse.items)) {
            userAnswers = userAnswersResponse.items;
          } else if (Array.isArray(userAnswersResponse.answers)) {
            userAnswers = userAnswersResponse.answers;
          } else {
            // Если это объект с ответами, преобразуем в массив
            const values = Object.values(userAnswersResponse);
            if (values.length > 0 && Array.isArray(values[0])) {
              userAnswers = values[0] as any[];
            } else {
              // ИСПРАВЛЕНО: Логируем как warning только если ответ не пустой, иначе это нормально
              if (userAnswersResponse && typeof userAnswersResponse === 'object' && Object.keys(userAnswersResponse).length > 0) {
                clientLogger.warn('⚠️ Не удалось нормализовать формат ответов', { 
                  type: typeof userAnswersResponse,
                  keys: Object.keys(userAnswersResponse || {}),
                  isArray: Array.isArray(userAnswersResponse)
                });
              } else {
                // Пустой ответ - это нормально, логируем как info
                clientLogger.log('ℹ️ Ответы пользователя еще не заполнены');
              }
            }
          }
        }
        
        // ИСПРАВЛЕНО: Валидация структуры ответов - фильтруем только похожие на ожидаемую структуру
        // Это предотвращает скрытие реальных проблем API (например, неожиданный формат)
        const looksLikeAnswer = (x: any) => {
          if (!x || typeof x !== 'object') return false;
          // Проверяем наличие хотя бы одного из ожидаемых полей
          return 'answerValue' in x || 'question' in x || 'questionCode' in x || 'code' in x;
        };
        userAnswers = userAnswers.filter(looksLikeAnswer);
        
        clientLogger.log('📋 Загружены ответы пользователя:', { 
          count: userAnswers.length,
          originalType: typeof userAnswersResponse,
          isOriginalArray: Array.isArray(userAnswersResponse),
          normalizedCount: userAnswers.length
        });
        
        if (userAnswers.length > 0) {
          // ИСПРАВЛЕНО: Поддержка альтернативных форматов ответа
          // Поддерживаем: a.question?.code, a.questionCode, a.code
          const nameAnswer = userAnswers.find((a: any) => {
            const code = a.question?.code ?? a.questionCode ?? a.code;
            return code === 'USER_NAME';
          });
          
          // ИСПРАВЛЕНО: Поддержка альтернативных полей для значения ответа
          const answerValue = nameAnswer?.answerValue ?? nameAnswer?.value ?? nameAnswer?.text;
          
          clientLogger.log('🔍 Поиск ответа USER_NAME:', { 
            found: !!nameAnswer,
            answerValue,
            questionCode: nameAnswer?.question?.code ?? nameAnswer?.questionCode ?? nameAnswer?.code
          });
          
          if (nameAnswer && answerValue && String(answerValue).trim().length > 0) {
            userNameFromAnswer = String(answerValue).trim();
            setDisplayNameFromAnswer(userNameFromAnswer);
            clientLogger.log('✅ Имя найдено в ответах USER_NAME:', userNameFromAnswer);
          } else {
            clientLogger.warn('⚠️ Ответ USER_NAME не найден или пустой', { 
              hasAnswer: !!nameAnswer,
              answerValue
            });
          }
        } else {
          // ИСПРАВЛЕНО: Не логируем как warning, если ответы действительно пусты (это нормально для новых пользователей)
          // Логируем только если был ответ от API, но он не был распознан
          if (userAnswersResponse && typeof userAnswersResponse === 'object' && Object.keys(userAnswersResponse).length > 0) {
            clientLogger.warn('⚠️ Ответы пользователя пусты или не найдены', { 
              originalResponse: userAnswersResponse,
              normalizedCount: userAnswers.length
            });
          } else {
            // Просто логируем как info, что ответы пусты (нормально для новых пользователей)
            clientLogger.log('ℹ️ Ответы пользователя еще не заполнены (нормально для новых пользователей)');
          }
        }
      } catch (err: any) {
        // ИСПРАВЛЕНО: Не логируем 429 ошибки как warning (rate limiting)
        if (err?.status !== 429) {
          clientLogger.warn('Could not load user answers for name:', err);
        }
      }
      
      // ИСПРАВЛЕНО: Выбираем один источник правды для Telegram user
      // Приоритет: tg.initDataUnsafe.user (более надежный) > useTelegram().user (fallback)
      const telegramUser = tg?.initDataUnsafe?.user || user;
      
      // Данные пользователя: сначала из ответа USER_NAME, потом из БД, потом из Telegram
      if (dbUser) {
        const profile: UserProfile = {
          id: dbUser.id || telegramUser?.id?.toString() || '',
          telegramId: dbUser.telegramId || telegramUser?.id?.toString() || '',
          username: dbUser.username || telegramUser?.username,
          // ИСПРАВЛЕНО: Приоритет имени: ответ USER_NAME > БД > Telegram
          firstName: userNameFromAnswer || dbUser.firstName || telegramUser?.first_name || undefined,
          lastName: dbUser.lastName || telegramUser?.last_name || undefined,
          language: dbUser.language || telegramUser?.language_code,
          phoneNumber: dbUser.phoneNumber || undefined,
        };
        setUserProfile(profile);
        // ИСПРАВЛЕНО: Используем имя из ответа USER_NAME, если оно есть
        setNameValue(userNameFromAnswer || [dbUser.firstName || telegramUser?.first_name, dbUser.lastName || telegramUser?.last_name].filter(Boolean).join(' ') || '');
        setPhoneValue(dbUser.phoneNumber || '');
      } else if (telegramUser) {
        // Если БД недоступна, используем данные из Telegram
        const profile: UserProfile = {
          id: telegramUser.id.toString(),
          telegramId: telegramUser.id.toString(),
          username: telegramUser.username,
          // ИСПРАВЛЕНО: Приоритет имени: ответ USER_NAME > Telegram
          firstName: userNameFromAnswer || telegramUser.first_name || undefined,
          lastName: telegramUser.last_name || undefined,
          language: telegramUser.language_code,
          phoneNumber: undefined,
        };
        setUserProfile(profile);
        // ИСПРАВЛЕНО: Используем имя из ответа USER_NAME, если оно есть
        setNameValue(userNameFromAnswer || [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || '');
        setPhoneValue('');
      }

      // Профиль кожи
      try {
        const profile = await api.getCurrentProfile() as SkinProfile | null;
        if (profile) {
        setSkinProfile(profile);
        }
        
        // Пробуем загрузить план для вычисления текущего дня
        // Используем getPlan() который НЕ триггерит генерацию (только проверяет кэш)
        // Не показываем ошибки, если план еще не готов
        try {
          const plan = await api.getPlan() as any;
          // Проверяем наличие плана в новом или старом формате
          // ИСПРАВЛЕНО: Используем дату создания плана (plan.createdAt или daysSinceCreation) вместо skinProfile.createdAt
          // Это более корректно, так как план может быть пересоздан, а профиль кожи - пересоздан раньше/позже
          if (plan && (plan.weeks || plan.plan28)) {
            let planStartDate: Date | null = null;
            
            // Пытаемся получить дату старта плана из разных источников
            if (plan.createdAt) {
              // Если план содержит createdAt напрямую
              planStartDate = new Date(plan.createdAt);
            } else if (plan.daysSinceCreation !== undefined) {
              // Если есть daysSinceCreation, вычисляем дату старта обратно
              const now = new Date();
              planStartDate = new Date(now.getTime() - (plan.daysSinceCreation * 24 * 60 * 60 * 1000));
            } else if (profile?.createdAt) {
              // Fallback: используем дату создания профиля (старое поведение)
              planStartDate = new Date(profile.createdAt);
            }
            
            if (planStartDate) {
              const now = new Date();
              const daysDiff = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
              const currentDay = Math.min(daysDiff + 1, 28);
              
              setPlanInfo({
                currentDay: currentDay > 0 ? currentDay : 1,
                totalDays: 28,
                started: true,
              });
            } else {
              // Если не удалось определить дату старта, используем fallback на профиль
              if (profile) {
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
            }
          } else {
            // План еще не готов - это нормально, не показываем ошибку
            if (process.env.NODE_ENV === 'development') {
              clientLogger.log('Plan not yet generated, will be generated on demand');
            }
          }
        } catch (planErr: any) {
          // Не показываем ошибки загрузки плана - он может еще не быть сгенерирован
          // getPlan() теперь НЕ триггерит генерацию, поэтому 404 - это нормально
          if (planErr?.status !== 404 && !planErr?.isNotFound && 
              !planErr?.message?.includes('No skin profile') &&
              !planErr?.message?.includes('Not found') &&
              !planErr?.message?.includes('Plan not found')) {
            clientLogger.warn('Unexpected error loading plan:', planErr);
          } else {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.log('Plan not yet generated (this is normal)');
            }
          }
        }
      } catch (err: any) {
        if (!err?.message?.includes('No profile found') && !err?.message?.includes('404')) {
          clientLogger.warn('Ошибка загрузки профиля:', err);
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

  // ИСПРАВЛЕНО: Валидация телефона - простая проверка формата
  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    const trimmed = phone.trim();
    
    // Минимальная валидация: должен быть хотя бы 10 цифр (для российских номеров)
    // Или начинаться с + и содержать цифры
    if (trimmed.length === 0) {
      return { isValid: true }; // Пустой номер - это нормально (можно не указывать)
    }
    
    // ИСПРАВЛЕНО: Проверяем, содержит ли номер + не в начале (некорректный формат)
    if (trimmed.includes('+') && !trimmed.startsWith('+')) {
      return { isValid: false, error: 'Символ + может быть только в начале номера' };
    }
    
    if (trimmed.startsWith('+')) {
      // Международный формат: + и минимум 10 цифр
      // Удаляем все нецифровые символы (включая +) для подсчета цифр
      const digitsOnly = trimmed.replace(/[^\d]/g, '');
      const digitCount = digitsOnly.length;
      if (digitCount < 10) {
        return { isValid: false, error: 'Номер должен содержать минимум 10 цифр' };
      }
    } else {
      // Российский формат: минимум 10 цифр, без символа +
      // ИСПРАВЛЕНО: Удаляем все нецифровые символы (включая возможный +) для подсчета цифр
      const digitsOnly = trimmed.replace(/[^\d]/g, '');
      const digitCount = digitsOnly.length;
      if (digitCount < 10) {
        return { isValid: false, error: 'Номер должен содержать минимум 10 цифр' };
      }
    }
    
    return { isValid: true };
  };

  const handleSavePhone = async () => {
    try {
      const trimmedPhone = phoneValue.trim();
      
      // ИСПРАВЛЕНО: Валидация телефона перед сохранением
      const validation = validatePhone(trimmedPhone);
      if (!validation.isValid) {
        toast.error(validation.error || 'Неверный формат номера телефона');
        return;
      }
      
      await api.updateUserProfile({
        phoneNumber: trimmedPhone,
      });
      
      setUserProfile(prev => prev ? {
        ...prev,
        phoneNumber: trimmedPhone,
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
    const botUsername = 'skinplanned_bot';
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
            onClick={() => window.location.reload()}
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
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  // Вычисляем полное имя для отображения - приоритет: ответ USER_NAME > профиль > Telegram
  const fullName = displayNameFromAnswer || (userProfile 
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.username || 'Пользователь'
    : 'Пользователь');

  // Вычисляем статистику
  const daysInApp = skinProfile 
    ? Math.floor((new Date().getTime() - new Date(skinProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const completedDays = planInfo.currentDay || 0;

  // ИСПРАВЛЕНО: Выбираем один источник правды для Telegram user
  // Приоритет: tg.initDataUnsafe.user (более надежный) > useTelegram().user (fallback)
  // Это предотвращает мигания при синхронизации useTelegram
  const telegramUser = tg?.initDataUnsafe?.user || user;
  const userPhotoUrl = telegramUser?.photo_url;

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
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-block',
          }}
        >
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '140px',
            marginTop: '8px',
            marginBottom: '8px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
          }}
        />
        </button>
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
            <TelegramUserAvatar user={telegramUser || undefined} size="lg" />
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
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
            Часто задаваемые вопросы
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                question: 'Как работает SkinIQ?',
                answer: 'SkinIQ анализирует вашу кожу на основе ответов в анкете и создает персональный 28-дневный план ухода. Мы учитываем тип кожи, проблемы, чувствительность и другие факторы для подбора оптимальных средств.',
              },
              {
                question: 'Как часто нужно обновлять план?',
                answer: 'Рекомендуется перепроходить анкету раз в 3-6 месяцев или при значительных изменениях состояния кожи (сезонные изменения, новые проблемы, смена климата).',
              },
              {
                question: 'Где купить рекомендованные средства?',
                answer: 'Все средства из вашего плана можно купить в аптеках, на маркетплейсах (Ozon, Wildberries) или в специализированных магазинах. В приложении есть прямые ссылки на покупку.',
              },
              {
                question: 'Что делать, если средство не подошло?',
                answer: 'Вы можете заменить любое средство из плана на альтернативное. Нажмите кнопку "Не подошло — заменить" рядом с продуктом, и мы предложим подходящие варианты.',
              },
              {
                question: 'Как отслеживать прогресс?',
                answer: 'В разделе "План" вы видите текущий день и прогресс выполнения. Отмечайте выполненные дни, чтобы видеть свой прогресс. Результаты обычно видны через 4-6 недель регулярного использования.',
              },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: expandedFAQ === index ? 'rgba(10, 95, 89, 0.05)' : 'transparent',
                  borderRadius: '12px',
                  padding: expandedFAQ === index ? '12px' : '0',
                  transition: 'all 0.2s',
                }}
              >
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? false : index)}
                style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
                    padding: '8px 0',
                    textAlign: 'left',
                  }}
                >
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#0A5F59',
                    margin: 0,
                    flex: 1,
                  }}>
                    {item.question}
                  </h4>
                  <span style={{
                    fontSize: '18px',
                    color: '#0A5F59',
                    marginLeft: '12px',
                    transition: 'transform 0.2s',
                    transform: expandedFAQ === index ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    ▼
                  </span>
                </button>
                {expandedFAQ === index && (
                  <p style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#475467',
                    lineHeight: '1.6',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(10, 95, 89, 0.1)',
                  }}>
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
            </div>
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
              Операторы на связи в будние дни с 10:00 до 19:00 (МСК)
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
