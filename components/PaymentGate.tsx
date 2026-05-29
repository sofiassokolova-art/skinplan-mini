// components/PaymentGate.tsx
// Компонент оплаты для плана через платежный провайдер + вебхук

'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { usePaywallVisibility } from '@/providers/PaywallVisibilityContext';
import { DEV_TELEGRAM } from '@/lib/config/timeouts';
import { AppLoader } from '@/components/AppLoader';

interface PaymentGateProps {
  price?: number;
  productCode?: 'plan_access' | 'subscription_month' | 'retake_topic' | 'retake_full';
  isRetaking: boolean;
  onPaymentComplete: () => void;
  retakeCta?: { text: string; href: string };
  cancelCta?: { text: string; onClick: () => void };
  children: React.ReactNode;
}

const PRODUCT_PRICES: Record<string, number> = {
  plan_access: 199,
  retake_topic: 49, // ИСПРАВЛЕНО: цена за перепрохождение одной темы
  retake_full: 99, // Цена за полное перепрохождение анкеты
  subscription_month: 499,
};

function shouldMockTelegramInitData(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NEXT_PUBLIC_ALLOW_TEST_INIT_DATA === 'true') return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('staging.')) {
      return true;
    }
  }
  return false;
}

function getInitDataForClient(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let initData = window.Telegram?.WebApp?.initData || '';

  try {
    if (!initData) {
      initData = sessionStorage.getItem('tg_init_data') || '';
    }
  } catch {
    // ignore
  }

  // Локально / staging: мокаем initData для тестового эмулятора оплаты
  if (!initData && shouldMockTelegramInitData()) {
    const testData = DEV_TELEGRAM.buildInitData();
    if (!(window as any).Telegram) {
      (window as any).Telegram = { WebApp: { initData: testData, ready() {}, expand() {} } };
    } else if (!(window as any).Telegram.WebApp) {
      (window as any).Telegram.WebApp = { initData: testData, ready() {}, expand() {} };
    } else {
      try {
        (window as any).Telegram.WebApp.initData = testData;
      } catch {
        // ignore
      }
    }
    initData = testData;
  }

  return initData || '';
}

// Глобальный кеш — чтобы множество PaymentGate (на /quiz) не спамили /api/me/entitlements
let entitlementsCache: { codes: string[]; ts: number } | null = null;
let entitlementsPromise: Promise<string[]> | null = null;
const ENTITLEMENTS_TTL_MS = 5000;

function requiredEntitlementCode(productCode: string): string {
  if (productCode === 'plan_access') return 'paid_access';
  if (productCode === 'retake_topic') return 'retake_topic_access';
  if (productCode === 'retake_full') return 'retake_full_access';
  // Для подписки пока не вводим отдельный код — считаем, что она тоже даёт paid_access
  return 'paid_access';
}

async function fetchEntitlementCodes(initData: string): Promise<string[]> {
  const response = await fetch('/api/me/entitlements', {
    method: 'GET',
    headers: {
      'X-Telegram-Init-Data': initData,
    },
  });

  if (!response.ok) {
    console.warn('[PaymentGate] Entitlements API returned error:', response.status, response.statusText);
    return [];
  }
  
  const data = await response.json();
  console.log('[PaymentGate] Entitlements API response:', data);
  
  // ApiResponse.success() в проекте возвращает payload напрямую (без { data: ... }),
  // но поддерживаем оба формата на всякий случай.
  const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;

  const entitlements = payload?.entitlements;
  if (Array.isArray(entitlements)) {
    const codes = entitlements
      .map((e: any) => (typeof e?.code === 'string' ? e.code : null))
      .filter((c: any): c is string => typeof c === 'string');
    console.log('[PaymentGate] Extracted entitlement codes:', codes);
    return codes;
  }

  // Fallback: если API вернул только paid=true без списка
  if (payload?.paid === true) {
    console.log('[PaymentGate] Using fallback: paid=true, returning paid_access');
    return ['paid_access'];
  }
  
  console.log('[PaymentGate] No entitlements found, returning empty array');
  return [];
}

export function PaymentGate({
  price,
  productCode = 'plan_access',
  isRetaking,
  onPaymentComplete,
  retakeCta,
  cancelCta,
  children,
}: PaymentGateProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // hasPaid = "уверены, что оплата есть" (проверяется через Entitlement)
  const [hasPaid, setHasPaid] = useState(false);
  const [checkingDbPayment, setCheckingDbPayment] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [initDataReady, setInitDataReady] = useState(false);
  const { setPaywallVisible } = usePaywallVisibility();

  // Сообщаем layout, что пейвол виден — скрыть нижнюю навигацию (на /plan и /home)
  useEffect(() => {
    setPaywallVisible(!hasPaid);
    return () => setPaywallVisible(false);
  }, [hasPaid, setPaywallVisible]);

  // Ждем появления Telegram initData (иначе paywall может "мигать" при повторном входе в приложение)
  useEffect(() => {
    let cancelled = false;

    // Если уже есть initData — готовы
    const current = getInitDataForClient();
    if (current) {
      setInitDataReady(true);
      return;
    }

    // Ждём до 5 секунд — на медленном мобильном скрипт telegram-web-app.js грузится дольше
    const start = Date.now();
    const INIT_DATA_TIMEOUT = 5000;
    const intervalId = setInterval(() => {
      if (cancelled) return;
      const initData =
        typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';
      if (initData) {
        clearInterval(intervalId);
        setInitDataReady(true);
        return;
      }
      if (Date.now() - start > INIT_DATA_TIMEOUT) {
        clearInterval(intervalId);
        setInitDataReady(false);
        setCheckedOnce(true);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // Когда initDataReady становится true, сбрасываем checkingDbPayment чтобы перепроверить entitlements
  useEffect(() => {
    if (initDataReady && !checkedOnce) {
      setCheckingDbPayment(false);
    }
  }, [initDataReady, checkedOnce]);

  // ВАЖНО: paywall один на главной и плане.
  // Если пользователь оплатил на одном экране и сразу перешел на другой,
  // второй PaymentGate может успеть смонтироваться ДО обновления entitlement.
  // Поэтому для plan_access мы короткое время перепроверяем entitlement в фоне.
  useEffect(() => {
    if (hasPaid) return;
    if (productCode !== 'plan_access') return;

    // До 30 секунд после монтирования обновляем статус раз в 2 секунды.
    // Глобальный cache/promise внутри PaymentGate не даст спамить API слишком сильно.
    const intervalId = setInterval(() => setRefreshTick((t) => t + 1), 2000);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 30000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [hasPaid, productCode]);

  // ПРАВИЛЬНАЯ ЛОГИКА: источник правды — БД через /api/me/entitlements
  // Проверяем Entitlement, а не теги пользователя
  // В dev короткий таймаут, чтобы на локальном сервере не ждать на главной/плане
  const ENTITLEMENTS_CHECK_TIMEOUT_MS =
    process.env.NODE_ENV === 'development' ? 500 : 8000;

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let fallbackTimeoutId: NodeJS.Timeout | null = null;

    const checkEntitlements = async () => {
      if (checkingDbPayment) return;

      try {
        setCheckingDbPayment(true);

        const initData = getInitDataForClient();
        if (!initData) {
          // initData ещё не готов — выходим, таймаут установлен отдельно
          return;
        }

        const now = Date.now();
        if (entitlementsCache && now - entitlementsCache.ts < ENTITLEMENTS_TTL_MS) {
          if (isMounted) {
            const required = requiredEntitlementCode(productCode);
            setHasPaid(entitlementsCache.codes.includes(required));
            setCheckedOnce(true);
          }
          return;
        }

        if (!entitlementsPromise) {
          entitlementsPromise = fetchEntitlementCodes(initData)
            .then((codes) => {
              entitlementsCache = { codes, ts: Date.now() };
              return codes;
            })
            .finally(() => {
              entitlementsPromise = null;
            });
        }

        const codes = await entitlementsPromise;
        const required = requiredEntitlementCode(productCode);
        if (isMounted) {
          const hasAccess = codes.includes(required);
          console.log('[PaymentGate] Entitlements checked:', { codes, required, hasAccess });
          setHasPaid(hasAccess);
          setCheckedOnce(true);
        }
      } catch (error) {
        // В проде это просто значит: временно опираемся на локальный флаг
        if (isMounted) {
          console.warn('Could not check entitlements from DB:', error);
          setCheckedOnce(true);
        }
      } finally {
        if (isMounted) {
          setCheckingDbPayment(false);
        }
      }
    };

    // Если initDataReady, проверяем entitlements
    if (initDataReady) {
      console.log('[PaymentGate] initDataReady is true, checking entitlements');
      checkEntitlements();
      // В dev: сразу показываем контент, проверка в фоне; при таймауте API ничего не меняем
      if (process.env.NODE_ENV === 'development') {
        if (isMounted) {
          setHasPaid(true);
          setCheckedOnce(true);
          setCheckingDbPayment(false);
        }
        return () => {
          isMounted = false;
          if (timeoutId) clearTimeout(timeoutId);
          if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        };
      }
      // Прод: не зависать на лоадере — через N с показываем paywall
      fallbackTimeoutId = setTimeout(() => {
        if (isMounted) {
          setCheckedOnce(true);
          setCheckingDbPayment(false);
          console.warn('[PaymentGate] Entitlements check timeout, showing paywall');
        }
      }, ENTITLEMENTS_CHECK_TIMEOUT_MS);
    } else {
      // Если initData еще не готов, устанавливаем таймаут для показа paywall через 3 секунды
      console.log('[PaymentGate] initDataReady is false, setting 3s timeout to show paywall');
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('[PaymentGate] initData not available after timeout, showing paywall');
          setCheckedOnce(true);
        }
      }, 3000);
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    };
  }, [isRetaking, productCode, refreshTick, initDataReady]);

  // Polling для проверки статуса оплаты после создания платежа
  useEffect(() => {
    if (!paymentId) return;

    const checkPaymentStatus = async () => {
      const initData = getInitDataForClient();
      if (!initData) return;

      try {
        const codes = await fetchEntitlementCodes(initData);
        entitlementsCache = { codes, ts: Date.now() };
        const required = requiredEntitlementCode(productCode);

        if (codes.includes(required)) {
          setHasPaid(true);
          setPaymentId(null);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          toast.success('Оплата успешно обработана!');
          setTimeout(() => {
            onPaymentComplete();
          }, 500);
        }
      } catch (error) {
        console.warn('Could not check payment status:', error);
      }
    };

    // Проверяем каждые 2 секунды
    pollingIntervalRef.current = setInterval(checkPaymentStatus, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [paymentId, onPaymentComplete, productCode]);

  const handlePayment = async () => {
    if (!agreedToTerms) {
      toast.error('Необходимо согласиться с пользовательским соглашением');
      return;
    }

    setIsProcessing(true);

    try {
      const initData = getInitDataForClient();
      if (!initData) {
        toast.error('Откройте приложение через Telegram Mini App для оплаты');
        setIsProcessing(false);
        return;
      }

      // После старта оплаты сбрасываем кеш entitlement, чтобы второй экран (план/главная)
      // быстрее увидел "paid_access".
      entitlementsCache = null;

      // Создаем платеж через правильный endpoint
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          productCode,
        }),
      });

      if (!response.ok) {
        let message = 'Не удалось создать платеж. Попробуйте ещё раз.';
        try {
          const errBody = await response.json();
          if (typeof errBody?.error === 'string' && errBody.error.trim()) {
            message = errBody.error;
          }
        } catch {
          const errorText = await response.text().catch(() => '');
          if (errorText) console.error('Payment creation failed:', response.status, errorText);
        }
        console.error('Payment creation failed:', response.status, message);
        toast.error(message);
        setIsProcessing(false);
        return;
      }

      const data = await response.json();
      // ИСПРАВЛЕНО: ApiResponse.success() возвращает данные напрямую, без обертки в { data: ... }
      // Проверяем оба варианта для совместимости
      const paymentData = data?.data || data;

      if (!paymentData || typeof paymentData !== 'object') {
        console.error('Invalid payment response:', data);
        toast.error('Неверный ответ от сервера');
        setIsProcessing(false);
        return;
      }

      // Если платеж уже успешен (идемпотентность)
      if (paymentData.status === 'succeeded' && paymentData.hasAccess) {
        setHasPaid(true);
        entitlementsCache = null;
        toast.success('Оплата успешно обработана!');
        setTimeout(() => {
          onPaymentComplete();
        }, 500);
        setIsProcessing(false);
        return;
      }

      if (paymentData.paymentId) {
        setPaymentId(paymentData.paymentId);
      }
      if (typeof paymentData.providerPaymentId === 'string' && paymentData.providerPaymentId) {
        setProviderPaymentId(paymentData.providerPaymentId);
      }

      const paymentUrl = typeof paymentData.paymentUrl === 'string' ? paymentData.paymentUrl : '';
      const isSimulatedCheckout = paymentUrl.includes('/payments/test');

      // Если есть paymentUrl - открываем его (для внешних платежных систем)
      if (paymentUrl) {
        if (isSimulatedCheckout && paymentData.paymentId) {
          // ИСПРАВЛЕНО: preview deployment на Vercel имеет NODE_ENV=production,
          // поэтому нельзя завязываться на NODE_ENV для симуляции.
          // Критерий симуляции: checkout URL ведет на /payments/test.
          toast('Тестовый платеж создан. Симулируем оплату...', { duration: 2000 });
          setTimeout(async () => {
            try {
              await fetch('/api/payments/test-webhook', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': initData,
                },
                body: JSON.stringify({ paymentId: paymentData.paymentId }),
              });
              // Polling добьёт entitlement; дополнительно держим paymentId установленным.
              setPaymentId(paymentData.paymentId);
            } catch (error) {
              console.warn('Failed to simulate webhook:', error);
            }
          }, 800);
        } else {
          window.open(paymentUrl, '_blank');
        }
      } else {
        // Если нет paymentUrl, возможно это Telegram Payments или другой провайдер
        // В этом случае просто ждем вебхук через polling
        toast.success('Платеж создан. Ожидаем подтверждения...');
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Ошибка при создании платежа. Попробуйте ещё раз.');
      setIsProcessing(false);
    }
  };

  // Очистка polling при размонтировании
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Если уже оплачено, показываем контент
  if (hasPaid) {
    return <>{children}</>;
  }

  // Ждём первой проверки entitlements — показываем полноэкранный лоадер
  if (!checkedOnce) {
    return (
      <AppLoader
        fullScreen
        variant="dark"
        zIndex={1000}
        message="Проверяем доступ..."
        subMessage={initDataReady ? 'Почти готово' : 'Открываем Telegram Mini App'}
      />
    );
  }

  const displayPrice =
    typeof price === 'number' && Number.isFinite(price) ? price : (PRODUCT_PRICES[productCode] ?? 0);

  const paywallTitle =
    productCode === 'retake_topic'
      ? 'Перепройдите тему'
      : productCode === 'retake_full'
        ? 'Пройдите анкету заново'
        : isRetaking
          ? 'Обновите доступ к плану'
          : 'Получите полный доступ к плану';

  const paywallSubtitle =
    productCode === 'retake_topic'
      ? 'Обновите только нужные части рекомендаций'
      : productCode === 'retake_full'
        ? 'Пройдите всю анкету заново. Счёт 28 дней начнётся заново'
        : isRetaking
          ? 'Персональные рекомендации на основе новых данных'
          : 'Персональный уход на 28 дней, подобранный под вашу кожу';

  const benefits = [
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="2"/>
          <path d="M5 3V2M11 3V2"/>
          <path d="M2 7h12"/>
          <path d="M6 10l1.5 1.5L11 8"/>
        </svg>
      ),
      title: '28-дневный план ухода',
      desc: 'Пошаговые рекомендации на каждый день',
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="6" r="3"/>
          <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
        </svg>
      ),
      title: 'Подбор под ваш тип кожи',
      desc: 'Средства и ингредиенты именно для вас',
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1.5L9.8 5.2L14 5.8L11 8.7L11.7 13L8 11L4.3 13L5 8.7L2 5.8L6.2 5.2L8 1.5Z"/>
        </svg>
      ),
      title: 'Одобрено дерматологами',
      desc: 'Все рекомендации безопасны и научно обоснованы',
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,9 6,13 14,4"/>
        </svg>
      ),
      title: 'Видимый результат',
      desc: 'Первые изменения уже через 2–3 недели',
    },
  ];

  const glassStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.52)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.65)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      overflowY: 'auto',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(213,254,97,0.22) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(10,95,89,0.10) 0%, transparent 60%), #f5f0eb',
    }}>
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: 'clamp(48px, 14vw, 72px) clamp(16px, 5vw, 24px) clamp(40px, 10vw, 56px)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}>

        {/* Бейдж */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(213,254,97,0.85)',
          borderRadius: '100px',
          padding: '6px 14px',
          fontSize: 'clamp(11px, 2.8vw, 13px)',
          fontWeight: 600,
          color: '#1a1a1a',
          letterSpacing: '0.3px',
          marginBottom: '18px',
          alignSelf: 'flex-start',
          fontFamily: "var(--font-inter), 'Inter', sans-serif",
        }}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1L8.09 4.29L11.72 4.84L9.11 7.38L9.74 11L6.5 9.29L3.26 11L3.89 7.38L1.28 4.84L4.91 4.29L6.5 1Z" fill="#000" stroke="#000" strokeWidth="0.8" strokeLinejoin="round"/>
          </svg>
          Ваш план готов
        </div>

        {/* Заголовок */}
        <h1 style={{
          fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, sans-serif",
          fontWeight: 700,
          fontSize: 'clamp(22px, 6.5vw, 30px)',
          lineHeight: 1.2,
          color: '#000',
          letterSpacing: '-0.5px',
          marginBottom: '8px',
        }}>
          {paywallTitle}
        </h1>
        <p style={{
          fontFamily: "var(--font-inter), 'Inter', sans-serif",
          fontSize: 'clamp(13px, 3.5vw, 15px)',
          color: '#555',
          lineHeight: 1.5,
          marginBottom: '28px',
        }}>
          {paywallSubtitle}
        </p>

        {/* Преимущества */}
        <div style={{ ...glassStyle, padding: '20px 18px', marginBottom: '16px' }}>
          {benefits.map((b, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              paddingTop: i === 0 ? 0 : '13px',
              paddingBottom: i === benefits.length - 1 ? 0 : '13px',
              borderBottom: i < benefits.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#D5FE61',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {b.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "var(--font-inter), 'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: 'clamp(13px, 3.5vw, 15px)',
                  color: '#111',
                  lineHeight: 1.3,
                }}>
                  {b.title}
                </div>
                <div style={{
                  fontFamily: "var(--font-inter), 'Inter', sans-serif",
                  fontSize: 'clamp(11px, 2.8vw, 13px)',
                  color: '#666',
                  lineHeight: 1.4,
                  marginTop: '2px',
                }}>
                  {b.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Цена */}
        <div style={{
          ...glassStyle,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
              fontSize: 'clamp(11px, 2.6vw, 12px)',
              color: '#999',
              textDecoration: 'line-through',
              marginBottom: '2px',
            }}>
              {displayPrice * 2} ₽
            </div>
            <div style={{
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
              fontSize: 'clamp(12px, 3vw, 14px)',
              color: '#555',
            }}>
              Единоразовый доступ
            </div>
          </div>
          <div style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(26px, 7vw, 34px)',
            color: '#000',
            letterSpacing: '-1px',
          }}>
            {displayPrice}<sup style={{ fontSize: '50%', verticalAlign: 'super', letterSpacing: 0 }}>₽</sup>
          </div>
        </div>

        {/* Чекбокс + кнопка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                marginTop: '1px',
                cursor: 'pointer',
                accentColor: '#D5FE61',
                flexShrink: 0,
              }}
            />
            <span style={{
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
              fontSize: 'clamp(11px, 2.8vw, 12px)',
              color: '#777',
              lineHeight: 1.5,
            }}>
              Я согласен с{' '}
              <a href="/terms" target="_blank" style={{ color: '#000', textDecoration: 'underline' }}>
                пользовательским соглашением
              </a>
              {' '}и{' '}
              <a href="/terms" target="_blank" style={{ color: '#000', textDecoration: 'underline' }}>
                политикой конфиденциальности
              </a>
            </span>
          </label>

          {/* Кнопка в стиле анкеты */}
          <button
            onClick={handlePayment}
            disabled={!agreedToTerms || isProcessing || !!paymentId}
            style={{
              width: '100%',
              height: '40px',
              background: agreedToTerms && !isProcessing && !paymentId ? '#D5FE61' : 'rgba(213,254,97,0.4)',
              color: '#000',
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
              fontWeight: 400,
              fontSize: '14px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              border: 'none',
              borderRadius: 0,
              cursor: agreedToTerms && !isProcessing && !paymentId ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.15s',
            }}
          >
            {paymentId
              ? 'Ожидаем подтверждения...'
              : isProcessing
                ? 'Создание платежа...'
                : `Оплатить ${displayPrice} ₽`}
          </button>

          {paymentId && (
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                fontSize: '12px',
                color: '#555',
                marginBottom: '6px',
              }}>
                Ожидаем подтверждения от платёжной системы…
              </p>
              <p style={{
                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                fontSize: '11px',
                color: '#888',
                wordBreak: 'break-all',
              }}>
                Код для поддержки: <strong>{providerPaymentId || paymentId}</strong>
              </p>
            </div>
          )}

          {/* Безопасность */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            fontFamily: "var(--font-inter), 'Inter', sans-serif",
            fontSize: 'clamp(10px, 2.5vw, 11px)',
            color: '#aaa',
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="7" height="5" rx="1.5"/>
              <path d="M3.5 5V3.5A2 2 0 0 1 7.5 3.5V5"/>
            </svg>
            Платёж безопасно обрабатывается через сервер
          </div>

          {cancelCta && (
            <button
              type="button"
              onClick={cancelCta.onClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                textAlign: 'center',
              }}
            >
              {cancelCta.text}
            </button>
          )}
          {retakeCta && (
            <button
              type="button"
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  try {
                    const { setIsRetakingQuiz } = await import('@/lib/user-preferences');
                    await setIsRetakingQuiz(true);
                  } catch {
                    // ignore
                  }
                  window.location.href = retakeCta.href;
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#000',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {retakeCta.text}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

