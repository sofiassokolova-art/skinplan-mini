// app/(miniapp)/cart/page.tsx
// Страница корзины (заглушка)

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CartPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '32px',
        padding: '40px 28px',
        textAlign: 'center',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
      }}>
        {/* Иконка корзины */}
        <div style={{
          fontSize: '64px',
          marginBottom: '24px',
        }}>
          🛍️
        </div>

        {/* Заголовок */}
        <h1 style={{
          fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '28px',
          lineHeight: '34px',
          color: '#0A5F59',
          margin: '0 0 12px 0',
        }}>
          Корзина
        </h1>

        {/* Описание */}
        <p style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '1.5',
          color: '#475467',
          margin: '0 0 32px 0',
        }}>
          Здесь будут отображаться товары из вашего плана ухода, которые вы хотите приобрести.
        </p>

        {/* Информация о функционале */}
        <div style={{
          backgroundColor: 'rgba(10, 95, 89, 0.08)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <p style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#0A5F59',
            margin: '0',
          }}>
            Функция корзины находится в разработке. Скоро здесь можно будет добавлять товары из плана и оформлять заказ.
          </p>
        </div>

        {/* Кнопка "Вернуться к плану" */}
        <button
          onClick={() => router.push('/plan')}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: '16px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#084b46';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(10, 95, 89, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0A5F59';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 95, 89, 0.2)';
          }}
        >
          Вернуться к плану
        </button>
      </div>
    </div>
  );
}

