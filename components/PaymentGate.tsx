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

  // Проверяем, оплатил ли пользователь ранее
  // ИСПРАВЛЕНО: Проверяем и localStorage, и БД (через API)
  const checkPaymentStatus = () => {
    if (typeof window === 'undefined') return false;
    const paymentKey = isRetaking ? 'payment_retaking_completed' : 'payment_first_completed';
    return localStorage.getItem(paymentKey) === 'true';
  };

  const [hasPaid, setHasPaid] = useState(checkPaymentStatus());
  const [checkingDbPayment, setCheckingDbPayment] = useState(false);

  // ИСПРАВЛЕНО: Проверяем статус оплаты в БД при монтировании
  useEffect(() => {
    const checkDbPaymentStatus = async () => {
      if (hasPaid || checkingDbPayment) return; // Уже оплачено или проверяем
      
      try {
        setCheckingDbPayment(true);
        const response = await fetch('/api/payment/check-status', {
          method: 'GET',
          headers: {
            'X-Telegram-Init-Data': typeof window !== 'undefined' ? (window.Telegram?.WebApp?.initData || '') : '',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data?.hasPaid) {
            // Устанавливаем в localStorage для быстрой проверки в будущем
            const paymentKey = isRetaking ? 'payment_retaking_completed' : 'payment_first_completed';
            if (typeof window !== 'undefined') {
              localStorage.setItem(paymentKey, 'true');
            }
            setHasPaid(true);
          }
        }
      } catch (error) {
        // Игнорируем ошибки проверки - используем только localStorage
        console.warn('Could not check payment status from DB:', error);
      } finally {
        setCheckingDbPayment(false);
      }
    };

    checkDbPaymentStatus();
  }, [isRetaking, hasPaid, checkingDbPayment]);

  const handlePayment = async () => {
    if (!agreedToTerms) {
      toast.error('Необходимо согласиться с пользовательским соглашением');
      return;
    }

    setIsProcessing(true);
    
    // Имитация обработки платежа
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Сохраняем статус оплаты
    if (typeof window !== 'undefined') {
      const paymentKey = isRetaking ? 'payment_retaking_completed' : 'payment_first_completed';
      localStorage.setItem(paymentKey, 'true');
      
      // ВАЖНО: НЕ удаляем флаг is_retaking_quiz после оплаты
      // Этот флаг нужен для логики перепрохождения анкеты
      // Он будет удален только после завершения перепрохождения
    }
    
    setIsPaid(true);
    setHasPaid(true);
    setIsProcessing(false);
    toast.success('Оплата успешно обработана!');
    
    // Небольшая задержка перед вызовом callback, чтобы пользователь увидел сообщение
    setTimeout(() => {
      onPaymentComplete();
    }, 500);
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

