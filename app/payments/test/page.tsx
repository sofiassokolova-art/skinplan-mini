// app/payments/test/page.tsx
// Эмулятор оплаты (staging / local). Подтверждение через test-webhook.

'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { DEV_TELEGRAM } from '@/lib/config/timeouts';

function getInitData(): string {
  if (typeof window === 'undefined') return '';
  const fromSdk = window.Telegram?.WebApp?.initData;
  if (fromSdk) return fromSdk;
  try {
    const stored = sessionStorage.getItem('tg_init_data');
    if (stored) return stored;
  } catch {
    // ignore
  }
  return DEV_TELEGRAM.buildInitData();
}

function TestPaymentContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams?.get('payment_id') || '';
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handlePay = useCallback(async () => {
    if (!paymentId) {
      toast.error('Нет payment_id в URL');
      return;
    }
    setBusy(true);
    try {
      const initData = getInitData();
      const webhookRes = await fetch('/api/payments/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ paymentId }),
      });

      if (!webhookRes.ok) {
        const err = await webhookRes.json().catch(() => ({}));
        toast.error(typeof err?.error === 'string' ? err.error : 'Ошибка симуляции оплаты');
        return;
      }

      setDone(true);
      toast.success('Тестовая оплата прошла успешно');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при симуляции оплаты');
    } finally {
      setBusy(false);
    }
  }, [paymentId]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          background: 'white',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{done ? '✅' : '🧪'}</div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#0A5F59',
            marginBottom: 12,
          }}
        >
          {done ? 'Оплата симулирована' : 'Тестовая оплата'}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: '#475467',
            marginBottom: 24,
            lineHeight: 1.5,
            wordBreak: 'break-all',
          }}
        >
          {done
            ? 'Вернитесь в Telegram Mini App — доступ должен открыться.'
            : `Платёж: ${paymentId || '—'}`}
        </p>
        {!done && (
          <button
            type="button"
            onClick={handlePay}
            disabled={busy || !paymentId}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              background: busy ? '#9CA3AF' : '#0A5F59',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              cursor: busy || !paymentId ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Обработка…' : 'Симулировать успешную оплату'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentsTestPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F5FFFC',
          }}
        >
          Загрузка…
        </div>
      }
    >
      <TestPaymentContent />
    </Suspense>
  );
}
