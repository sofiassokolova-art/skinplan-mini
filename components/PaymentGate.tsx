// components/PaymentGate.tsx
// Компонент оплаты для плана через платежный провайдер + вебхук

'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface PaymentGateProps {
  price?: number;
  productCode?: 'plan_access' | 'subscription_month' | 'retake_topic';
  isRetaking: boolean;
  onPaymentComplete: () => void;
  retakeCta?: { text: string; href: string };
  children: React.ReactNode;
}

const PRODUCT_PRICES: Record<string, number> = {
  plan_access: 199,
  retake_topic: 99,
  subscription_month: 499,
};

// Глобальный кеш — чтобы множество PaymentGate (на /quiz) не спамили /api/me/entitlements
let entitlementsCache: { codes: string[]; ts: number } | null = null;
let entitlementsPromise: Promise<string[]> | null = null;
const ENTITLEMENTS_TTL_MS = 5000;

function requiredEntitlementCode(productCode: string): string {
  if (productCode === 'plan_access') return 'paid_access';
  if (productCode === 'retake_topic') return 'retake_topic_access';
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

  if (!response.ok) return [];
  const data = await response.json();
  const entitlements = data?.data?.entitlements;
  if (!Array.isArray(entitlements)) return [];
  return entitlements
    .map((e: any) => (typeof e?.code === 'string' ? e.code : null))
    .filter((c: any): c is string => typeof c === 'string');
}

export function PaymentGate({
  price,
  productCode = 'plan_access',
  isRetaking,
  onPaymentComplete,
  retakeCta,
  children,
}: PaymentGateProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbChecked, setDbChecked] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // hasPaid = "уверены, что оплата есть" (проверяется через Entitlement)
  const [hasPaid, setHasPaid] = useState(false);
  const [checkingDbPayment, setCheckingDbPayment] = useState(false);

  // ПРАВИЛЬНАЯ ЛОГИКА: источник правды — БД через /api/me/entitlements
  // Проверяем Entitlement, а не теги пользователя
  useEffect(() => {
    let isMounted = true;

    const checkEntitlements = async () => {
      // Если уже отправлен запрос и мы получили ответ от БД — не дёргаем API повторно
      if (dbChecked) return;
      if (checkingDbPayment) return;

      try {
        setCheckingDbPayment(true);

        const initData =
          typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';
        if (!initData) {
          // В деве может не быть initData — тогда остаёмся на локальном флаге,
          // но помечаем, что проверка БД уже сделана, чтобы не спамить консоль
          if (isMounted) {
            setDbChecked(true);
          }
          return;
        }

        const now = Date.now();
        if (entitlementsCache && now - entitlementsCache.ts < ENTITLEMENTS_TTL_MS) {
          if (isMounted) {
            const required = requiredEntitlementCode(productCode);
            setHasPaid(entitlementsCache.codes.includes(required));
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
        if (isMounted) setHasPaid(codes.includes(required));
      } catch (error) {
        // В проде это просто значит: временно опираемся на локальный флаг
        if (isMounted) {
          console.warn('Could not check entitlements from DB:', error);
        }
      } finally {
        if (isMounted) {
          setCheckingDbPayment(false);
          setDbChecked(true);
        }
      }
    };

    checkEntitlements();

    return () => {
      isMounted = false;
    };
  }, [isRetaking, dbChecked, checkingDbPayment, productCode]);

  // Polling для проверки статуса оплаты после создания платежа
  useEffect(() => {
    if (!paymentId) return;

    const checkPaymentStatus = async () => {
      const initData =
        typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';
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
      const initData =
        typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';

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
        const errorText = await response.text().catch(() => '');
        console.error('Payment creation failed:', response.status, errorText);
        toast.error('Не удалось создать платеж. Попробуйте ещё раз.');
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
        toast.success('Оплата успешно обработана!');
        setTimeout(() => {
          onPaymentComplete();
        }, 500);
        setIsProcessing(false);
        return;
      }

      // Сохраняем paymentId для polling
      if (paymentData.paymentId) {
        setPaymentId(paymentData.paymentId);
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

  const displayPrice =
    typeof price === 'number' && Number.isFinite(price) ? price : (PRODUCT_PRICES[productCode] ?? 0);

  return (
    <div style={{ position: 'relative' }}>
      {/* Замыленный контент */}
      <div style={{
        filter: 'blur(8px)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.5,
      }}>
        {children}
      </div>

      {/* Overlay с оплатой */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        zIndex: 1000,
        borderRadius: '24px',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}>
            🔒
          </div>
          
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            {productCode === 'retake_topic'
              ? 'Перепройдите тему'
              : isRetaking
                ? 'Обновите доступ к плану'
                : 'Получите полный доступ к плану'}
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            {productCode === 'retake_topic'
              ? 'Выберите тему, оплатите 99 ₽ и обновите только затронутые части рекомендаций.'
              : isRetaking 
                ? 'Обновите свой план ухода и получите персональные рекомендации на основе новых данных'
                : 'Оплатите доступ, чтобы увидеть полный план ухода на 28 дней с персональными рекомендациями'}
          </p>

          {/* Цена */}
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: '#F5FFFC',
            borderRadius: '16px',
            border: '2px solid #0A5F59',
          }}>
            <div style={{
              fontSize: '14px',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              Стоимость
            </div>
            <div style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#0A5F59',
            }}>
              {displayPrice} ₽
            </div>
          </div>

          {/* Чекбокс согласия */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '24px',
            cursor: 'pointer',
            textAlign: 'left',
          }}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                marginTop: '2px',
                cursor: 'pointer',
                accentColor: '#0A5F59',
              }}
            />
            <span style={{
              fontSize: '14px',
              color: '#475467',
              lineHeight: '1.5',
            }}>
              Я согласен с{' '}
              <a 
                href="/terms" 
                target="_blank"
                style={{ color: '#0A5F59', textDecoration: 'underline' }}
              >
                пользовательским соглашением
              </a>
              {' '}и{' '}
              <a 
                href="/terms" 
                target="_blank"
                style={{ color: '#0A5F59', textDecoration: 'underline' }}
              >
                политикой конфиденциальности
              </a>
            </span>
          </label>

          {/* Кнопка оплаты */}
          <button
            onClick={handlePayment}
            disabled={!agreedToTerms || isProcessing || !!paymentId}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: agreedToTerms && !isProcessing && !paymentId
                ? 'linear-gradient(to right, #0A5F59, #059669)'
                : '#D1D5DB',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: agreedToTerms && !isProcessing && !paymentId ? 'pointer' : 'not-allowed',
              boxShadow: agreedToTerms && !isProcessing && !paymentId
                ? '0 8px 24px rgba(10, 95, 89, 0.4)'
                : 'none',
              transition: 'all 0.2s',
              opacity: agreedToTerms && !isProcessing && !paymentId ? 1 : 0.6,
            }}
          >
            {paymentId 
              ? 'Ожидаем подтверждения оплаты...' 
              : isProcessing 
                ? 'Создание платежа...' 
                : `Оплатить ${displayPrice} ₽`}
          </button>

          {paymentId && (
            <p style={{
              fontSize: '12px',
              color: '#0A5F59',
              marginTop: '12px',
            }}>
              Платеж создан. Ожидаем подтверждения от платежной системы...
            </p>
          )}

          <p style={{
            fontSize: '12px',
            color: '#9CA3AF',
            marginTop: paymentId ? '8px' : '16px',
          }}>
            Платеж обрабатывается безопасно через сервер
          </p>

          {retakeCta && (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // ИСПРАВЛЕНО: ретейк-ссылка должна открывать экран выбора тем
                  // (/quiz показывает экран выбора тем, когда is_retaking_quiz=true)
                  try {
                    localStorage.setItem('is_retaking_quiz', 'true');
                  } catch {
                    // ignore
                  }
                  window.location.href = retakeCta.href;
                }
              }}
              style={{
                marginTop: '16px',
                background: 'transparent',
                border: 'none',
                color: '#0A5F59',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
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

