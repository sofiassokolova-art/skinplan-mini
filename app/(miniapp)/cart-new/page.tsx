// app/(miniapp)/cart-new/page.tsx
// Страница корзины

'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// Отключаем статическую генерацию для этой страницы
export const dynamic = 'force-dynamic';

interface CartItem {
  id: string;
  product: {
    id: number;
    name: string;
    brand: {
      id: number;
      name: string;
    };
    price: number | null;
    imageUrl: string | null;
    link: string | null;
    marketLinks: any;
  };
  quantity: number;
  createdAt: string;
}

function CartPageContent() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const data = await api.getCart() as { items?: CartItem[] };
      setCartItems(data.items || []);
    } catch (err: any) {
      console.error('Error loading cart:', err);
      toast.error('Ошибка загрузки корзины');
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId: number) => {
    try {
      await api.removeFromCart(productId);
      setCartItems(prev => prev.filter(item => item.product.id !== productId));
      toast.success('Товар удалён из корзины');
    } catch (err: any) {
      console.error('Error removing from cart:', err);
      toast.error('Ошибка удаления товара');
    }
  };

  const handleBuy = (product: CartItem['product']) => {
    // Используем deep link из БД или marketLinks
    const marketLinks = product.marketLinks as any || {};
    const link = product.link || marketLinks.ozon || marketLinks.wildberries || marketLinks.apteka;
    
    if (link) {
      window.open(link, '_blank');
    } else {
      toast.error('Ссылка на покупку не найдена');
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => {
    return sum + ((item.product.price || 0) * item.quantity);
  }, 0);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '18px', color: '#475467' }}>Загрузка корзины...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
        paddingBottom: cartItems.length > 0 ? '140px' : '120px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '8px',
          }}
        >
          Корзина
        </h1>
        <p style={{ fontSize: '16px', color: '#475467' }}>
          {cartItems.length > 0 
            ? `${cartItems.length} товар${cartItems.length > 1 ? 'а' : ''} на сумму ${totalPrice} ₽`
            : 'Ваша корзина пуста'}
        </p>
      </div>

      {cartItems.length === 0 ? (
        // Пустое состояние
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            marginTop: '40px',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛒</div>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
            Корзина пуста
          </h3>
          <p style={{ fontSize: '16px', color: '#475467', marginBottom: '32px' }}>
            Добавьте товары из плана или избранного
          </p>
          <Link
            href="/plan"
            style={{
              display: 'inline-block',
              backgroundColor: '#0A5F59',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '16px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            Открыть план ухода
          </Link>
        </div>
      ) : (
        <>
          {/* Список товаров */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cartItems.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(28px)',
                  borderRadius: '20px',
                  padding: '16px',
                  border: '1px solid rgba(10, 95, 89, 0.1)',
                }}
              >
                <div style={{ display: 'flex', gap: '16px' }}>
                  {/* Изображение */}
                  {item.product.imageUrl && (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                      }}
                    />
                  )}

                  {/* Информация */}
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#0A5F59',
                        marginBottom: '4px',
                      }}
                    >
                      {item.product.name}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#475467', marginBottom: '8px' }}>
                      {item.product.brand.name}
                      {item.product.price && ` • ${item.product.price} ₽`}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
                      Количество: {item.quantity}
                    </p>

                    {/* Кнопки */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleBuy(item.product)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: 'none',
                          backgroundColor: '#0A5F59',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Купить
                      </button>
                      <button
                        onClick={() => handleRemove(item.product.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: '1px solid #E5E7EB',
                          backgroundColor: 'transparent',
                          color: '#EF4444',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Итоговая сумма */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(28px)',
              borderTop: '1px solid rgba(10, 95, 89, 0.1)',
              padding: '20px',
              boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
            }}
          >
            <div style={{ maxWidth: '420px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A5F59' }}>
                  Итого:
                </span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0A5F59' }}>
                  {totalPrice} ₽
                </span>
              </div>
              <button
                onClick={() => {
                  cartItems.forEach(item => handleBuy(item.product));
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '24px',
                  border: 'none',
                  background: 'linear-gradient(to right, #0A5F59, #059669)',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(10, 95, 89, 0.4)',
                }}
              >
                Купить всё ({cartItems.length} товар{cartItems.length > 1 ? 'а' : ''})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '18px', color: '#475467' }}>Загрузка...</div>
      </div>
    }>
      <CartPageContent />
    </Suspense>
  );
}

