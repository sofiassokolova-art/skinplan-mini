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
      
      // Загружаем wishlist без обязательной проверки авторизации
      // API вернет пустой список, если нет авторизации
      const data = await api.getWishlist();
      // Маппим данные из API в формат WishlistItemData
      const items: WishlistItemData[] = (data.items || []).map(item => ({
        id: item.id,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          brand: {
            id: item.product.brand?.id || 0,
            name: item.product.brand.name,
          },
          price: item.product.price,
          imageUrl: item.product.imageUrl,
          link: item.product.link || null,
          marketLinks: item.product.marketLinks || null,
        } : {
          id: item.productId,
          name: 'Неизвестный продукт',
          brand: { id: 0, name: 'Unknown' },
          price: null,
          imageUrl: null,
          link: null,
          marketLinks: null,
        },
        feedback: item.feedback || '',
        createdAt: item.createdAt,
      }));
      setWishlist(items);
    } catch (err: any) {
      console.error('Error loading wishlist:', err);
      // Любые ошибки обрабатываем как пустое состояние
      setWishlist([]);
      setError(null);
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
        backgroundAttachment: 'fixed',
        padding: '20px',
        paddingBottom: '120px',
      }}
    >
      {/* Логотип */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        marginTop: '-20px',
        marginLeft: '-20px',
        marginRight: '-20px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-block',
          }}
        >
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '140px',
            marginTop: '8px',
            marginBottom: '8px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
          }}
        />
        </button>
      </div>
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

      {/* Ошибки не показываем, так как они обрабатываются в loadWishlist */}

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

        </>
      )}
    </div>
  );
}
