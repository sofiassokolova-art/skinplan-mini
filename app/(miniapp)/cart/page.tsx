// app/(miniapp)/cart/page.tsx
// Страница избранного (wishlist)

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import WishlistItem from '@/components/WishlistItem';
import toast from 'react-hot-toast';

interface WishlistItemData {
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
  feedback: string;
  createdAt: string;
}

export default function CartPage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState<WishlistItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getWishlist() as { items?: WishlistItemData[] };
      // Обрабатываем разные форматы ответа
      const items = data.items || (data as any).wishlist || [];
      setWishlist(Array.isArray(items) ? items : []);
    } catch (err: any) {
      console.error('Error loading wishlist:', err);
      const errorMessage = err?.message || 'Не удалось загрузить избранное';
      
      // Для ошибок авторизации просто показываем пустое состояние (пользователь не авторизован через Telegram)
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('initData')) {
        console.log('⚠️ Пользователь не авторизован - показываем пустое состояние');
        setWishlist([]);
        setError(null); // Не показываем ошибку, показываем пустое состояние
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId: number) => {
    try {
      await api.removeFromWishlist(productId);
      setWishlist((prev) => prev.filter((item) => item.product.id !== productId));
      toast.success('Продукт удалён из избранного');
    } catch (err: any) {
      console.error('Error removing from wishlist:', err);
      toast.error('Ошибка удаления продукта');
    }
  };

  const handleBuyAll = () => {
    // Открываем все ссылки в новых вкладках
    const links: string[] = [];
    
    wishlist.forEach((item) => {
      const marketLinks = item.product.marketLinks as any || {};
      if (marketLinks.ozon) links.push(marketLinks.ozon);
      if (marketLinks.wildberries) links.push(marketLinks.wildberries);
      if (marketLinks.apteka) links.push(marketLinks.apteka);
      if (item.product.link && !marketLinks.ozon && !marketLinks.wildberries && !marketLinks.apteka) {
        links.push(item.product.link);
      }
    });

    // Открываем уникальные ссылки
    const uniqueLinks = [...new Set(links)];
    uniqueLinks.forEach((link) => {
      window.open(link, '_blank');
    });

    if (uniqueLinks.length === 0) {
      toast.error('Ссылки на покупку не найдены');
    } else {
      toast.success(`Открыто ${uniqueLinks.length} ссылок`);
    }
  };

  const minPrice = wishlist.reduce((sum, item) => {
    return sum + (item.product.price || 0);
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
        <div style={{ fontSize: '18px', color: '#475467' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
        paddingBottom: wishlist.length > 0 ? '140px' : '120px',
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
          Ваши выбранные средства
        </h1>
        <p style={{ fontSize: '16px', color: '#475467' }}>
          Мы подобрали их специально под вашу кожу
        </p>
      </div>

      {error && !error.includes('Unauthorized') && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#991B1B',
            padding: '16px',
            borderRadius: '16px',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}

      {wishlist.length === 0 ? (
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
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛍️</div>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '12px' }}>
            Вы ещё ничего не добавили
          </h3>
          <p style={{ fontSize: '16px', color: '#475467', marginBottom: '32px' }}>
            Нажмите 🛍️ в плане — средства появятся здесь
          </p>
          <Link
            href="/plan"
            style={{
              display: 'inline-block',
              backgroundColor: '#8B5CF6',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '16px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            }}
          >
            Открыть план ухода
          </Link>
        </div>
      ) : (
        <>
          {/* Список средств */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {wishlist.map((item) => (
              <WishlistItem
                key={item.id}
                item={item}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* Кнопка "Купить всё" */}
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
              <button
                onClick={handleBuyAll}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: '24px',
                  border: 'none',
                  background: 'linear-gradient(to right, #8B5CF6, #EC4899)',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
                  marginBottom: '12px',
                }}
              >
                Купить всё в один клик ({wishlist.length} товара{wishlist.length > 1 ? '' : ''} • от {minPrice} ₽)
              </button>
              <p
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#475467',
                  margin: 0,
                }}
              >
                Откроем лучшие цены в аптеках и маркетплейсах
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
