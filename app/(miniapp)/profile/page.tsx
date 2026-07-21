// app/(miniapp)/profile/page.tsx
// Личный кабинет пользователя.
// Дизайн выровнен с редизайн-палитрой: чистый фон var(--canvas), заголовки
// Unbounded, белые карточки, тёмная карточка прогресса плана с лаймовым акцентом.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTelegram, resolveTelegramInitData } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { MiniAppPageSkeleton } from '@/components/ui/SkeletonLoader';
import { CareRemindersSettings } from '@/components/CareRemindersSettings';
import toast from 'react-hot-toast';
import { clientLogger } from '@/lib/client-logger';
import { resolvePlanRetakeHref } from '@/lib/paywall-product';

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

// Склонение «N дней» для подписи в карточке плана
function daysWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
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
    return <MiniAppPageSkeleton background="var(--canvas)" rows={4} />;
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

  // ИСПРАВЛЕНО: Выбираем один источник правды для Telegram user
  // Приоритет: tg.initDataUnsafe.user (более надежный) > useTelegram().user (fallback)
  // Это предотвращает мигания при синхронизации useTelegram
  const telegramUser = tg?.initDataUnsafe?.user || user;
  const userPhotoUrl = telegramUser?.photo_url;
  const avatarNameSource =
    displayNameFromAnswer ||
    userProfile?.firstName ||
    telegramUser?.first_name ||
    '';
  const avatarInitial = avatarNameSource.trim().slice(0, 1).toUpperCase();

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
        /* Фон — фиксированный псевдо-слой, чтобы Telegram iOS WebView не показывал
           чужую подложку при overscroll. */
        .pf-rd{position:relative;}
        .pf-rd::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--canvas);}
        .pf-rd .pf-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 6px;}
        .pf-rd .pf-logo{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:500;letter-spacing:0;color:var(--ink);text-transform:lowercase;}
        /* Шапка: аватар + имя */
        .pf-rd .pf-head{display:flex;align-items:center;gap:14px;padding:8px 20px 4px;}
        .pf-rd .pf-avatar-wrap{position:relative;flex-shrink:0;width:64px;height:64px;}
        .pf-rd .pf-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px #fff,0 6px 18px rgba(10,10,10,0.12);}
        .pf-rd .pf-avatar-fallback{background:var(--ink);color:var(--accent);display:grid;place-items:center;font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:24px;font-weight:700;}
        .pf-rd .pf-avatar-wrap::after{content:"";position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;background:var(--accent-deep,#C2F03C);border:3px solid var(--canvas);}
        .pf-rd .pf-eyebrow{font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-mute);}
        .pf-rd .pf-title{font-family:var(--font-unbounded),-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:600;line-height:1.15;letter-spacing:-0.4px;color:var(--ink);margin:3px 0 0;overflow-wrap:anywhere;}
        .pf-rd .pf-username{margin-top:2px;font-size:13px;font-weight:500;color:var(--ink-soft);}
        /* Стек с группами */
        .pf-rd .pf-stack{padding:0 20px;}
        .pf-rd .pf-group-title{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-mute);margin:26px 4px 12px;}
        /* Флэт-карточки */
        .pf-rd .pf-card{border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:20px;box-shadow:var(--glass-shadow);}
        .pf-rd .pf-links{display:flex;flex-direction:column;gap:10px;}
        .pf-rd .pf-link{display:flex;align-items:center;gap:14px;padding:16px;width:100%;text-align:left;border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:20px;box-shadow:var(--glass-shadow);cursor:pointer;text-decoration:none;color:inherit;font-family:inherit;transition:transform 0.14s ease;}
        .pf-rd .pf-link:active{transform:scale(0.99);}
        .pf-rd .pf-link-ic{width:38px;height:38px;flex-shrink:0;border-radius:12px;background:rgba(var(--accent-rgb),0.3);display:grid;place-items:center;color:var(--ink);}
        .pf-rd .pf-link-ic.quiet{background:rgba(10,10,10,0.05);}
        .pf-rd .pf-link-ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
        .pf-rd .pf-link-body{flex:1;min-width:0;}
        .pf-rd .pf-link-title{display:block;font-size:14.5px;font-weight:600;letter-spacing:-0.01em;color:var(--ink);}
        .pf-rd .pf-link-sub{display:block;margin-top:3px;font-size:12px;line-height:1.35;color:var(--ink-soft);}
        .pf-rd .pf-link-arrow{flex-shrink:0;color:var(--ink-mute);display:grid;place-items:center;}
        .pf-rd .pf-link-arrow svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .pf-rd .pf-link.danger .pf-link-title{color:#D92D20;}
        .pf-rd .pf-link.danger .pf-link-ic{background:rgba(217,45,32,0.10);color:#D92D20;}
        .pf-rd .pf-link-dark{background:var(--ink);border-color:rgba(255,255,255,0.10);box-shadow:0 14px 34px -16px rgba(10,10,10,0.55);}
        .pf-rd .pf-link-dark .pf-link-title{color:#fff;}
        .pf-rd .pf-link-dark .pf-link-sub{color:rgba(255,255,255,0.6);}
        .pf-rd .pf-link-dark .pf-link-ic{background:rgba(var(--accent-rgb),0.2);color:var(--accent);}
        .pf-rd .pf-link-dark .pf-link-arrow{color:rgba(255,255,255,0.5);}
        /* Личные данные */
        .pf-rd .pf-data{padding:4px 18px;}
        .pf-rd .pf-row{padding:16px 0;border-top:1px solid rgba(10,10,10,0.06);}
        .pf-rd .pf-row:first-child{border-top:0;}
        .pf-rd .pf-row-line{display:flex;align-items:center;justify-content:space-between;gap:12px;}
        .pf-rd .pf-kicker{font-size:11px;color:var(--ink-mute);margin-bottom:4px;}
        .pf-rd .pf-value{font-size:14.5px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;}
        .pf-rd .pf-value.empty{color:var(--ink-mute);font-weight:500;}
        .pf-rd .pf-edit-btn{flex-shrink:0;border:0;background:transparent;color:var(--ink);font-size:13px;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer;}
        .pf-rd .pf-input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(10,10,10,0.10);background:#fff;font-family:inherit;font-size:16px;color:var(--ink);outline:none;}
        .pf-rd .pf-input:focus{border-color:rgba(10,10,10,0.35);}
        .pf-rd .pf-edit-actions{display:flex;align-items:center;gap:12px;margin-top:10px;}
        .pf-rd .pf-save{flex:1;height:44px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:transform 0.14s ease;}
        .pf-rd .pf-save:active{transform:scale(0.985);}
        .pf-rd .pf-cancel{border:0;background:transparent;padding:6px 10px;color:var(--ink-soft);font-size:13px;font-weight:500;text-decoration:underline;cursor:pointer;}
        /* О приложении */
        .pf-rd .pf-about{padding:4px 18px;}
        .pf-rd .pf-about-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid rgba(10,10,10,0.06);font-size:13.5px;}
        .pf-rd .pf-about-row:first-child{border-top:0;}
        .pf-rd .pf-about-label{font-weight:500;color:var(--ink-soft);}
        .pf-rd .pf-about-value{font-weight:600;color:var(--ink);text-align:right;}
      `}</style>

      {/* Topbar */}
      <div className="pf-topbar">
        <div className="pf-logo">skiniq</div>
      </div>

      {/* Шапка: аватар + имя */}
      <div className="pf-head">
        <span className="pf-avatar-wrap">
          {userPhotoUrl ? (
            <img className="pf-avatar" src={userPhotoUrl} alt={fullName} />
          ) : (
            <span className="pf-avatar pf-avatar-fallback" aria-hidden>{avatarInitial}</span>
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="pf-eyebrow">Личный кабинет</div>
          <h1 className="pf-title">{fullName}</h1>
          {userProfile?.username && <div className="pf-username">@{userProfile.username}</div>}
        </div>
      </div>

      <div className="pf-stack">
        {/* ── Мой уход ── */}
        <div className="pf-group-title">Мой уход</div>
        <div className="pf-links">
          {/* Напоминания об уходе (утро/вечер в боте) */}
          <CareRemindersSettings />

          {/* Личный кабинет доступен после оплаты → экран выбора тем, а не рестарт с нуля */}
          <Link href={resolvePlanRetakeHref(true)} className="pf-link pf-link-dark">
            <span className="pf-link-ic">
              <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v6h-6M3 20v-6h6"/></svg>
            </span>
            <span className="pf-link-body">
              <span className="pf-link-title">Перепройти анкету</span>
              <span className="pf-link-sub">Обновить рекомендации под текущее состояние кожи</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </Link>
        </div>

        {/* ── Личные данные ── */}
        <div className="pf-group-title">Личные данные</div>
        <div className="pf-card pf-data">
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
        </div>

        {/* ── Помощь ── */}
        <div className="pf-group-title">Помощь</div>
        <div className="pf-links">
          <button className="pf-link" type="button" onClick={handleOpenSupport}>
            <span className="pf-link-ic"><ChatIcon /></span>
            <span className="pf-link-body">
              <span className="pf-link-title">Поддержка</span>
              <span className="pf-link-sub">Пн–Пт, 10:00–19:00 (МСК)</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </button>

          <Link href="/faq" className="pf-link">
            <span className="pf-link-ic quiet">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17h.01"/></svg>
            </span>
            <span className="pf-link-body">
              <span className="pf-link-title">Частые вопросы</span>
              <span className="pf-link-sub">Как работает план и уход</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </Link>
        </div>

        {/* ── Правовое ── */}
        <div className="pf-group-title">Правовое</div>
        <div className="pf-links">
          <Link href="/terms" className="pf-link">
            <span className="pf-link-ic quiet"><DocIcon /></span>
            <span className="pf-link-body">
              <span className="pf-link-title">Пользовательское соглашение</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </Link>

          <Link href="/privacy" className="pf-link">
            <span className="pf-link-ic quiet">
              <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/></svg>
            </span>
            <span className="pf-link-body">
              <span className="pf-link-title">Политика конфиденциальности</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </Link>

          <button className="pf-link danger" type="button" onClick={handleDeleteData}>
            <span className="pf-link-ic quiet">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </span>
            <span className="pf-link-body">
              <span className="pf-link-title">Удаление данных</span>
              <span className="pf-link-sub">Очистить мой профиль и удалить аккаунт</span>
            </span>
            <span className="pf-link-arrow"><ChevronRightIcon /></span>
          </button>
        </div>

        {/* ── О приложении ── */}
        <div className="pf-group-title">О приложении</div>
        <div className="pf-card pf-about">
          <div className="pf-about-row">
            <span className="pf-about-label">Версия</span>
            <span className="pf-about-value">
              {process.env.NEXT_PUBLIC_APP_VERSION || '—'}
              {process.env.NEXT_PUBLIC_APP_COMMIT ? ` · ${process.env.NEXT_PUBLIC_APP_COMMIT}` : ''}
            </span>
          </div>
          <div className="pf-about-row">
            <span className="pf-about-label">Разработчик</span>
            <span className="pf-about-value">ИП Биктимирова</span>
          </div>
        </div>
      </div>
    </div>
  );
}
