// components/PaymentGate.tsx
// Компонент имитации оплаты для плана

'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface PaymentGateProps {
  price: number;
  isRetaking: boolean;
  onPaymentComplete: () => void;
  children: React.ReactNode;
}

export function PaymentGate({ price, isRetaking, onPaymentComplete, children }: PaymentGateProps) {
  const [isPaid, setIsPaid] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbChecked, setDbChecked] = useState(false);

  // Локальный кэш статуса оплаты в браузере (ускорение, но не источник правды)
  const getLocalPaymentFlag = () => {
    if (typeof window === 'undefined') return false;
    const paymentKey = isRetaking ? 'payment_retaking_completed' : 'payment_first_completed';
    return localStorage.getItem(paymentKey) === 'true';
  };

  // hasPaid = "уверены, что оплата есть" (БД или локальный кэш)
  const [hasPaid, setHasPaid] = useState(getLocalPaymentFlag());
  const [checkingDbPayment, setCheckingDbPayment] = useState(false);

  // ПРОДОВСКАЯ ЛОГИКА: источник правды — БД через /api/payment/check-status
  // localStorage только кэширует результат, но всегда перепроверяется по API
  useEffect(() => {
    let isMounted = true;

    const checkDbPaymentStatus = async () => {
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

        const response = await fetch('/api/payment/check-status', {
          method: 'GET',
          headers: {
            'X-Telegram-Init-Data': initData,
          },
        });

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          const dbHasPaid = !!data?.hasPaid;

          const paymentKey = isRetaking
            ? 'payment_retaking_completed'
            : 'payment_first_completed';

          if (dbHasPaid) {
            // Бэкенд говорит "оплачено" — синхронизируем кэш и состояние
            if (typeof window !== 'undefined') {
              localStorage.setItem(paymentKey, 'true');
            }
            setHasPaid(true);
          } else {
            // Бэкенд говорит "НЕ оплачено" — чистим локальный флаг, если он был
            if (typeof window !== 'undefined') {
              localStorage.removeItem(paymentKey);
            }
            setHasPaid(false);
          }
        }
      } catch (error) {
        // В проде это просто значит: временно опираемся на локальный флаг
        if (isMounted) {
          console.warn('Could not check payment status from DB:', error);
        }
      } finally {
        if (isMounted) {
          setCheckingDbPayment(false);
          setDbChecked(true);
        }
      }
    };

    checkDbPaymentStatus();

    return () => {
      isMounted = false;
    };
  }, [isRetaking, dbChecked, checkingDbPayment]);

  const handlePayment = async () => {
    if (!agreedToTerms) {
      toast.error('Необходимо согласиться с пользовательским соглашением');
      return;
    }

    setIsProcessing(true);

    try {
      // Имитация API Юкассы: просто отмечаем оплату на бэке через /api/payment/set-status
      const initData =
        typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';

      const response = await fetch('/api/payment/set-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
      });

      if (!response.ok) {
        // Если по какой-то причине бэк вернул ошибку — не ставим статус "оплачено"
        const errorText = await response.text().catch(() => '');
        console.error('Payment set-status failed:', response.status, errorText);
        toast.error('Не удалось отметить оплату. Попробуйте ещё раз.');
        setIsProcessing(false);
        return;
      }

      // Успешно отметили оплату на сервере — синхронизируем локальный кэш
      if (typeof window !== 'undefined') {
        const paymentKey = isRetaking ? 'payment_retaking_completed' : 'payment_first_completed';
        localStorage.setItem(paymentKey, 'true');
      }

      setIsPaid(true);
      setHasPaid(true);
      toast.success('Оплата успешно обработана!');

      // Небольшая задержка перед callback, чтобы пользователь увидел сообщение
      setTimeout(() => {
        onPaymentComplete();
      }, 500);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Ошибка при обработке оплаты. Попробуйте ещё раз.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Если уже оплачено, показываем контент
  if (hasPaid) {
    return <>{children}</>;
  }

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
            {isRetaking ? 'Обновите доступ к плану' : 'Получите полный доступ к плану'}
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            {isRetaking 
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
              {price} ₽
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
            disabled={!agreedToTerms || isProcessing}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: agreedToTerms && !isProcessing
                ? 'linear-gradient(to right, #0A5F59, #059669)'
                : '#D1D5DB',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: agreedToTerms && !isProcessing ? 'pointer' : 'not-allowed',
              boxShadow: agreedToTerms && !isProcessing
                ? '0 8px 24px rgba(10, 95, 89, 0.4)'
                : 'none',
              transition: 'all 0.2s',
              opacity: agreedToTerms && !isProcessing ? 1 : 0.6,
            }}
          >
            {isProcessing ? 'Обработка...' : `Оплатить ${price} ₽`}
          </button>

          <p style={{
            fontSize: '12px',
            color: '#9CA3AF',
            marginTop: '16px',
          }}>
            Платеж обрабатывается безопасно
          </p>
        </div>
      </div>
    </div>
  );
}

