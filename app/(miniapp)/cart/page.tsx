// app/(miniapp)/cart/page.tsx
// Страница избранного (wishlist) — редизайн «Избранное»

'use client';

import Link from 'next/link';
import { useWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist';
import { useCart, useAddToCart } from '@/hooks/useCart';
import type { WishlistResponse } from '@/lib/api-types';
import { TabLoadingShell } from '@/components/TabLoadingShell';
import { ProfileAvatarButton } from '@/components/ProfileAvatarButton';
import toast from 'react-hot-toast';

interface WishlistItemData {
  id: string;
  product: {
    id: number;
    name: string;
    brand: { id: number; name: string };
    imageUrl: string | null;
    link: string | null;
    marketLinks: any;
  };
  feedback: string;
  createdAt: string;
}

export default function FavoritesPage() {
  const { data: wishlistData, isLoading: loading } = useWishlist();
  const removeMutation = useRemoveFromWishlist();
  const { data: cartData } = useCart();
  const addToCart = useAddToCart();

  const cartIds = new Set<number>((cartData?.items || []).map((i: any) => i.product?.id));

  const wishlist: WishlistItemData[] = (wishlistData?.items || []).map((item: WishlistResponse['items'][0]) => ({
    id: item.id,
    product: item.product ? {
      id: item.product.id,
      name: item.product.name,
      brand: { id: item.product.brand?.id || 0, name: item.product.brand?.name || 'Unknown' },
      imageUrl: item.product.imageUrl,
      link: item.product.link || null,
      marketLinks: item.product.marketLinks || null,
    } : {
      id: item.productId,
      name: 'Неизвестный продукт',
      brand: { id: 0, name: 'Unknown' },
      imageUrl: null,
      link: null,
      marketLinks: null,
    },
    feedback: item.feedback || '',
    createdAt: item.createdAt,
  }));

  const handleRemove = async (productId: number) => {
    try {
      await removeMutation.mutateAsync(productId);
      toast.success('Удалено из избранного');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const handleAddToCart = async (productId: number) => {
    if (cartIds.has(productId)) return;
    try {
      await addToCart.mutateAsync({ productId, quantity: 1 });
      toast.success('Добавлено в корзину');
    } catch {
      toast.error('Не удалось добавить');
    }
  };

  const bg =
    'radial-gradient(58% 26% at 100% 0%, rgba(213,254,97,0.5) 0%, transparent 65%),' +
    'radial-gradient(72% 32% at 0% 22%, rgba(255,224,188,0.55) 0%, transparent 65%),' +
    'radial-gradient(60% 22% at 100% 60%, rgba(220,210,196,0.5) 0%, transparent 65%),' +
    'radial-gradient(78% 30% at 100% 92%, rgba(213,254,97,0.36) 0%, transparent 62%),' +
    '#F4F2EE';

  if (loading) {
    return <TabLoadingShell title="Избранное" background={bg} />;
  }

  return (
    <div className="fav-rd" style={{ minHeight: '100vh', background: bg, backgroundAttachment: 'fixed', padding: '8px 20px 120px' }}>
      <style>{`
        .fav-rd .fv-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 0 14px;}
        .fav-rd .fv-logo{font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.4px;color:#0A0A0A;}
        .fav-rd .fv-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,#0A0A0A);color:#D5FE61;display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:14px;font-weight:700;}
        .fav-rd .fv-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#D5FE61;border:2px solid #F4F2EE;}
        .fav-rd .fv-title{margin:6px 2px 18px;font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:26px;font-weight:700;letter-spacing:-0.6px;color:#0A0A0A;}
        .fav-rd .fv-list{display:flex;flex-direction:column;gap:10px;}
        .fav-rd .fv-item{position:relative;padding:12px;border:1px solid rgba(255,255,255,0.7);border-radius:22px;background:rgba(255,255,255,0.62);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);box-shadow:0 8px 22px rgba(0,0,0,0.04);overflow:hidden;}
        .fav-rd .fv-del{position:absolute;top:10px;right:10px;z-index:3;width:28px;height:28px;border:0;border-radius:50%;background:rgba(10,10,10,0.06);color:#0A0A0A;display:grid;place-items:center;cursor:pointer;}
        .fav-rd .fv-del:active{transform:scale(0.9);}
        .fav-rd .fv-del svg{fill:none;stroke:#0A0A0A;stroke-width:1.6;}
        .fav-rd .fv-body{min-width:0;display:flex;flex-direction:column;gap:8px;padding-right:44px;}
        .fav-rd .fv-brand{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;}
        .fav-rd .fv-name{font-size:14px;font-weight:700;line-height:1.22;letter-spacing:-0.15px;color:#0A0A0A;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .fav-rd .fv-cta{width:100%;height:44px;border:0;border-radius:999px;background:#D5FE61;color:#000;font-family:var(--font-inter),sans-serif;font-weight:700;font-size:14px;letter-spacing:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(213,254,97,0.26);transition:transform .14s ease,box-shadow .14s ease;margin-top:2px;}
        .fav-rd .fv-cta:active{transform:scale(0.985);box-shadow:0 4px 10px rgba(213,254,97,0.22);}
        .fav-rd .fv-cta.in{background:#0A0A0A;color:#fff;}
        .fav-rd .fv-empty{text-align:center;padding:60px 20px;background:rgba(255,255,255,0.62);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.7);border-radius:24px;margin-top:24px;}
        .fav-rd .fv-empty-cta{display:inline-block;background:#0A0A0A;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-family:var(--font-inter),sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.1px;box-shadow:0 10px 24px rgba(10,10,10,0.18);transition:transform .14s ease;}
        .fav-rd .fv-empty-cta:active{transform:scale(0.98);}
      `}</style>

      <div className="fv-topbar">
        <div className="fv-logo">SkinIQ</div>
        <ProfileAvatarButton className="fv-avatar" />
      </div>

      <h1 className="fv-title">Избранное</h1>

      {wishlist.length === 0 ? (
        <div className="fv-empty">
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0A0A0A', marginBottom: '8px' }}>Здесь пока пусто</h3>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>Сохраняйте средства из плана — они появятся тут</p>
          <Link href="/plan" className="fv-empty-cta">Открыть план</Link>
        </div>
      ) : (
        <div className="fv-list">
          {wishlist.map((item) => {
            const inCart = cartIds.has(item.product.id);
            return (
              <div className="fv-item" key={item.id}>
                <button className="fv-del" aria-label="Убрать из избранного" onClick={() => handleRemove(item.product.id)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.84a5.5 5.5 0 0 0 1.06-8.78Z"/>
                    <path d="M3 3l18 18"/>
                  </svg>
                </button>
                <div className="fv-body">
                  <div className="fv-brand">{item.product.brand.name}</div>
                  <div className="fv-name">{item.product.name}</div>
                  <button
                    className={`fv-cta${inCart ? ' in' : ''}`}
                    onClick={() => handleAddToCart(item.product.id)}
                    disabled={addToCart.isPending}
                  >
                    {inCart ? 'В корзине' : 'В корзину'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
