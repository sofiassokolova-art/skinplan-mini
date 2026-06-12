// app/(miniapp)/profile/page.tsx
// Личный кабинет пользователя.
// Дизайн выровнен с редизайн-палитрой (чёрно-лайм-беж): фон var(--canvas) с
// фикс-слоем градиентных пятен (как home-rd), заголовки Unbounded, glass-карточки,
// тёмная карточка прогресса плана с лаймовым акцентом, чёрные pill-кнопки.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTelegram, resolveTelegramInitData } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { MiniAppPageSkeleton } from '@/components/ui/SkeletonLoader';
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

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT =
  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
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
];

// Склонение «N дней» для подписи в карточке плана
function daysWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="pf-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export default function PersonalCabinet() {
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
        // resolveTelegramInitData: SDK → URL hash → sessionStorage. Скрипт
        // telegram.org может не загрузиться вовсе — initData всё равно доступен.
        if (resolveTelegramInitData()) {
          resolve();
          return;
        }
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = setInterval(() => {
          attempts++;
          if (resolveTelegramInitData() || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    };

    const init = async () => {
      await waitForTelegram();
      if (typeof window === 'undefined' || !resolveTelegramInitData()) {
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
    const botUsername = 'skiniq_app_bot';
    const supportUrl = `https://t.me/${botUsername}`;

    if (tg?.openTelegramLink) {
      tg.openTelegramLink(supportUrl);
    } else if (tg?.openLink) {
      tg.openLink(supportUrl);
    } else {
      window.open(supportUrl, '_blank');
    }
  };

  const handleDeleteData = async () => {
    const confirmed = window.confirm(
      'Удалить все ваши данные? Это действие необратимо: будут удалены анкета, план ухода и профиль, ' +
      'а согласие на обработку отозвано. Данные о платежах сохраняются по требованию закона.',
    );
    if (!confirmed) return;
    try {
      await api.deleteMyData();
      toast.success('Ваши данные удалены');
      // Возвращаем пользователя в начало — потребуется новое согласие и анкета.
      setTimeout(() => {
        window.location.href = '/quiz';
      }, 1200);
    } catch (err) {
      clientLogger.error('Ошибка удаления данных', err);
      toast.error('Не удалось удалить данные. Попробуйте позже.');
    }
  };

  if (loading) {
    return <MiniAppPageSkeleton rows={4} />;
  }

  if (error && !userProfile) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        backgroundColor: 'var(--canvas)',
        fontFamily: BODY_FONT,
      }}>
        <div className="glass-card-lg" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: TITLE_FONT,
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: 'var(--ink)',
            margin: '0 0 10px',
          }}>
            Не удалось загрузить профиль
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-soft)', margin: '0 0 18px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%',
              height: '48px',
              border: 0,
              borderRadius: '999px',
              background: 'var(--ink)',
              color: '#fff',
              fontFamily: BODY_FONT,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
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

  // Статистика для тёмной карточки плана
  const daysInApp = skinProfile
    ? Math.floor((new Date().getTime() - new Date(skinProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const planTotalDays = planInfo.totalDays || 28;
  const planPct = planInfo.started && planInfo.currentDay
    ? Math.round((planInfo.currentDay / planTotalDays) * 100)
    : 0;

  // ИСПРАВЛЕНО: Выбираем один источник правды для Telegram user
  // Приоритет: tg.initDataUnsafe.user (более надежный) > useTelegram().user (fallback)
  // Это предотвращает мигания при синхронизации useTelegram
  const telegramUser = tg?.initDataUnsafe?.user || user;
  const userPhotoUrl = telegramUser?.photo_url;
  const avatarInitial = (fullName[0] || 'S').toUpperCase();

  return (
    <div
      className="animate-fade-in pf-rd"
      style={{
        minHeight: '100vh',
        paddingBottom: '120px',
        fontFamily: BODY_FONT,
        color: 'var(--ink)',
      }}
    >
      <style>{`
        html, body { background-color: var(--canvas); }
        /* Фон — фиксированный псевдо-слой с градиентными пятнами, тот же рецепт,
           что на /home (background-attachment:fixed не работает в Telegram iOS WebView). */
        .pf-rd{position:relative;}
        .pf-rd::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:
          radial-gradient(72% 32% at 0% 0%, rgba(255,224,188,0.7) 0%, transparent 62%),
          radial-gradient(50% 22% at 100% 18%, rgba(213,254,97,0.42) 0%, transparent 70%),
          radial-gradient(64% 26% at 100% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),
          radial-gradient(78% 32% at 10% 92%, rgba(213,254,97,0.46) 0%, transparent 62%),
          var(--canvas);}
        .pf-rd .pf-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 14px;}
        .pf-rd .pf-logo{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.4px;color:var(--ink);}
        .pf-rd .pf-head{display:flex;align-items:center;gap:16px;padding:0 20px 18px;}
        .pf-rd .pf-avatar{width:64px;height:64px;flex-shrink:0;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);}
        .pf-rd .pf-avatar-fallback{background:linear-gradient(135deg,#2A2A2A,var(--ink));color:var(--accent);display:grid;place-items:center;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:600;}
        .pf-rd .pf-intro{font-size:12px;font-weight:500;color:var(--ink-soft);margin-bottom:4px;}
        .pf-rd .pf-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:700;line-height:1.15;letter-spacing:-0.5px;color:var(--ink);margin:0;overflow-wrap:anywhere;}
        .pf-rd .pf-username{margin-top:3px;font-size:13px;font-weight:500;color:var(--ink-soft);}
        .pf-rd .pf-stack{display:flex;flex-direction:column;gap:12px;padding:0 20px;}
        .pf-rd .pf-card-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:600;letter-spacing:-0.3px;color:var(--ink);margin:0 0 14px;}
        /* Тёмная карточка плана — как hr-progress-card на /home */
        .pf-rd .pf-plan-card{position:relative;overflow:hidden;padding:15px 18px 14px;border-radius:25px;border:1px solid rgba(255,255,255,0.07);color:#fff;background:radial-gradient(95% 125% at 105% -20%, rgba(213,254,97,0.22) 0%, transparent 66%), #111;box-shadow:0 16px 36px rgba(10,10,10,0.19);}
        .pf-rd .pf-plan-card::after{content:"";position:absolute;top:-52px;right:-34px;width:152px;height:152px;border-radius:50%;background:radial-gradient(circle, rgba(213,254,97,0.18) 0%, transparent 70%);pointer-events:none;}
        .pf-rd .pf-plan-head{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
        .pf-rd .pf-eyebrow{color:rgba(255,255,255,0.5);font-size:9px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;}
        .pf-rd .pf-plan-value{margin-top:7px;color:var(--accent);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:700;letter-spacing:-1px;line-height:1;}
        .pf-rd .pf-plan-sub{margin-top:5px;color:rgba(255,255,255,0.64);font-size:12px;font-weight:500;}
        .pf-rd .pf-plan-badge{position:relative;z-index:1;width:60px;height:60px;flex-shrink:0;display:grid;place-items:center;border:1px solid rgba(213,254,97,0.22);border-radius:50%;color:var(--accent);background:rgba(255,255,255,0.04);font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;}
        .pf-rd .pf-track{position:relative;height:7px;margin-top:14px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,0.1);}
        .pf-rd .pf-fill{position:absolute;left:0;top:0;bottom:0;border-radius:inherit;background:var(--accent);transition:width 0.28s ease;}
        /* Личные данные */
        .pf-rd .pf-row + .pf-row{margin-top:14px;padding-top:14px;border-top:1px solid rgba(10,10,10,0.06);}
        .pf-rd .pf-kicker{font-size:9px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;}
        .pf-rd .pf-row-line{display:flex;align-items:center;justify-content:space-between;gap:12px;}
        .pf-rd .pf-value{font-size:15px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;}
        .pf-rd .pf-value.empty{color:var(--ink-mute);font-weight:500;}
        .pf-rd .pf-edit-btn{flex-shrink:0;border:0;cursor:pointer;border-radius:999px;padding:8px 14px;background:rgba(10,10,10,0.07);color:var(--ink);font-size:12px;font-weight:600;transition:transform 0.14s ease;}
        .pf-rd .pf-edit-btn:active{transform:scale(0.96);}
        .pf-rd .pf-input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(10,10,10,0.10);background:rgba(255,255,255,0.92);font-family:inherit;font-size:16px;color:var(--ink);outline:none;}
        .pf-rd .pf-input:focus{border-color:rgba(10,10,10,0.35);}
        .pf-rd .pf-edit-actions{display:flex;align-items:center;gap:12px;margin-top:10px;}
        .pf-rd .pf-save{flex:1;height:44px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:transform 0.14s ease;}
        .pf-rd .pf-save:active{transform:scale(0.985);}
        .pf-rd .pf-cancel{border:0;background:transparent;padding:6px 10px;color:var(--ink-soft);font-size:13px;font-weight:500;text-decoration:underline;cursor:pointer;}
        /* FAQ */
        .pf-rd .pf-faq-item + .pf-faq-item{border-top:1px solid rgba(10,10,10,0.06);}
        .pf-rd .pf-faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;background:none;border:0;cursor:pointer;text-align:left;font-family:inherit;font-size:14px;font-weight:600;line-height:1.3;color:var(--ink);}
        .pf-rd .pf-faq-q svg{flex-shrink:0;color:var(--ink-mute);transition:transform 0.2s ease;}
        .pf-rd .pf-faq-q.open svg{transform:rotate(180deg);}
        .pf-rd .pf-faq-a{margin:0;padding:0 28px 14px 0;font-size:13px;line-height:1.55;color:#4B5563;}
        /* Ссылки-карточки (поддержка, соглашения) */
        .pf-rd .pf-link-card{display:flex;align-items:center;gap:14px;width:100%;border:0;cursor:pointer;text-decoration:none;text-align:left;color:inherit;font-family:inherit;transition:transform 0.14s ease;}
        .pf-rd .pf-link-card:active{transform:scale(0.985);}
        .pf-rd .pf-link-icon{width:40px;height:40px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--ink);box-shadow:0 2px 8px rgba(213,254,97,0.5);}
        .pf-rd .pf-link-icon.quiet{background:rgba(10,10,10,0.07);box-shadow:none;}
        .pf-rd .pf-link-body{flex:1;min-width:0;}
        .pf-rd .pf-link-title{display:block;font-size:15px;font-weight:600;color:var(--ink);}
        .pf-rd .pf-link-sub{display:block;margin-top:2px;font-size:12.5px;line-height:1.4;color:var(--ink-soft);}
        .pf-rd .pf-chevron{flex-shrink:0;color:var(--ink-mute);}
        /* О приложении */
        .pf-rd .pf-about-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:13.5px;}
        .pf-rd .pf-about-row + .pf-about-row{margin-top:10px;}
        .pf-rd .pf-about-label{font-weight:500;color:var(--ink-soft);}
        .pf-rd .pf-about-value{font-weight:600;color:var(--ink);text-align:right;}
      `}</style>

      {/* Topbar */}
      <div className="pf-topbar">
        <div className="pf-logo">SkinIQ</div>
      </div>

      {/* Шапка: аватар + имя */}
      <div className="pf-head">
        {userPhotoUrl ? (
          <img className="pf-avatar" src={userPhotoUrl} alt={fullName} />
        ) : (
          <div className="pf-avatar pf-avatar-fallback" aria-hidden>{avatarInitial}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="pf-intro">Личный кабинет</div>
          <h1 className="pf-title">{fullName}</h1>
          {userProfile?.username && <div className="pf-username">@{userProfile.username}</div>}
        </div>
      </div>

      <div className="pf-stack">
        {/* Тёмная карточка прогресса плана */}
        {planInfo.started && planInfo.currentDay && (
          <section className="pf-plan-card" aria-label="Прогресс плана">
            <div className="pf-plan-head">
              <div>
                <div className="pf-eyebrow">Ваш план ухода</div>
                <div className="pf-plan-value">День {planInfo.currentDay} из {planTotalDays}</div>
                {daysInApp >= 1 && (
                  <div className="pf-plan-sub">Со SkinIQ уже {daysInApp} {daysWord(daysInApp)}</div>
                )}
              </div>
              <div className="pf-plan-badge">{planPct}%</div>
            </div>
            <div className="pf-track">
              <div className="pf-fill" style={{ width: `${Math.max(4, planPct)}%` }} />
            </div>
          </section>
        )}

        {/* Личные данные */}
        <section className="glass-card-md">
          <h2 className="pf-card-title">Личные данные</h2>

          {/* Имя */}
          <div className="pf-row">
            <div className="pf-kicker">Имя</div>
            {editingName ? (
              <div>
                <input
                  className="pf-input"
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="Введите имя"
                />
                <div className="pf-edit-actions">
                  <button className="pf-save" onClick={handleSaveName}>Сохранить</button>
                  <button
                    className="pf-cancel"
                    onClick={() => {
                      setEditingName(false);
                      setNameValue([userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || '');
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="pf-row-line">
                <span className={`pf-value${nameValue ? '' : ' empty'}`}>{nameValue || 'Не указано'}</span>
                <button className="pf-edit-btn" onClick={() => setEditingName(true)}>Изменить</button>
              </div>
            )}
          </div>

          {/* Номер телефона */}
          <div className="pf-row">
            <div className="pf-kicker">Номер телефона</div>
            {editingPhone ? (
              <div>
                <input
                  className="pf-input"
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                />
                <div className="pf-edit-actions">
                  <button className="pf-save" onClick={handleSavePhone}>Сохранить</button>
                  <button
                    className="pf-cancel"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneValue(userProfile?.phoneNumber || '');
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="pf-row-line">
                <span className={`pf-value${phoneValue ? '' : ' empty'}`}>{phoneValue || 'Не указано'}</span>
                <button className="pf-edit-btn" onClick={() => setEditingPhone(true)}>Изменить</button>
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="glass-card-md">
          <h2 className="pf-card-title">Часто задаваемые вопросы</h2>
          <div>
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="pf-faq-item">
                <button
                  className={`pf-faq-q${expandedFAQ === index ? ' open' : ''}`}
                  aria-expanded={expandedFAQ === index}
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? false : index)}
                >
                  {item.question}
                  <ChevronDownIcon />
                </button>
                {expandedFAQ === index && <p className="pf-faq-a">{item.answer}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Поддержка */}
        <button className="glass-card-md pf-link-card" type="button" onClick={handleOpenSupport}>
          <span className="pf-link-icon"><ChatIcon /></span>
          <span className="pf-link-body">
            <span className="pf-link-title">Поддержка</span>
            <span className="pf-link-sub">Операторы на связи в будние дни с 10:00 до 19:00 (МСК)</span>
          </span>
          <ChevronRightIcon />
        </button>

        {/* Пользовательские соглашения */}
        <Link href="/terms" className="glass-card-md pf-link-card">
          <span className="pf-link-icon quiet"><DocIcon /></span>
          <span className="pf-link-body">
            <span className="pf-link-title">Пользовательские соглашения</span>
            <span className="pf-link-sub">Условия использования</span>
          </span>
          <ChevronRightIcon />
        </Link>

        {/* Политика конфиденциальности */}
        <Link href="/privacy" className="glass-card-md pf-link-card">
          <span className="pf-link-icon quiet"><DocIcon /></span>
          <span className="pf-link-body">
            <span className="pf-link-title">Политика конфиденциальности</span>
            <span className="pf-link-sub">Как мы обрабатываем ваши данные</span>
          </span>
          <ChevronRightIcon />
        </Link>

        {/* Удаление данных (право субъекта ПДн) */}
        <button
          className="glass-card-md pf-link-card"
          type="button"
          onClick={handleDeleteData}
          style={{ width: '100%' }}
        >
          <span className="pf-link-body">
            <span className="pf-link-title" style={{ color: '#D92D20' }}>Удалить мои данные</span>
            <span className="pf-link-sub">Отзыв согласия и удаление персональных данных</span>
          </span>
          <ChevronRightIcon />
        </button>

        {/* О приложении */}
        <section className="glass-card-md">
          <h2 className="pf-card-title">О приложении</h2>
          <div className="pf-about-row">
            <span className="pf-about-label">Версия</span>
            <span className="pf-about-value">{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}</span>
          </div>
          <div className="pf-about-row">
            <span className="pf-about-label">Разработчик</span>
            <span className="pf-about-value">ИП Биктимирова</span>
          </div>
        </section>
      </div>
    </div>
  );
}
