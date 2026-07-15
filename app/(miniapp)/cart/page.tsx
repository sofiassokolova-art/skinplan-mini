// app/(miniapp)/cart/page.tsx
// Страница избранного (wishlist) — редизайн «Избранное»

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist';
import { useCart, useAddToCart } from '@/hooks/useCart';
import { api } from '@/lib/api';
import type { WishlistResponse } from '@/lib/api-types';
import { TabLoadingShell } from '@/components/TabLoadingShell';
import { ProfileAvatarButton } from '@/components/ProfileAvatarButton';
import { formatPriceFrom } from '@/lib/price-display';
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
    priceFrom?: number | null;
  };
  feedback: string;
  createdAt: string;
}

export default function FavoritesPage() {
  const { data: wishlistData, isLoading: loading } = useWishlist();
  const removeMutation = useRemoveFromWishlist();
  const { data: cartData } = useCart();
  const addToCart = useAddToCart();
  const [feedbackOpenId, setFeedbackOpenId] = useState<number | null>(null);
  const [feedbackBusyId, setFeedbackBusyId] = useState<number | null>(null);
  const [feedbackByProduct, setFeedbackByProduct] = useState<Record<number, string>>({});

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
      priceFrom: item.product.priceFrom ?? null,
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

  const handleFeedback = async (productId: number, feedback: string) => {
    if (feedbackBusyId === productId) return;
    setFeedbackBusyId(productId);
    try {
      await api.submitWishlistFeedback(productId, feedback);
      setFeedbackByProduct((prev) => ({ ...prev, [productId]: feedback }));
      setFeedbackOpenId(null);
      toast.success('Спасибо за отзыв');
    } catch {
      toast.error('Не удалось сохранить отзыв');
    } finally {
      setFeedbackBusyId(null);
    }
  };

  const bg = 'var(--canvas)';

  if (loading) {
    return <TabLoadingShell title="Избранное" background={bg} />;
  }

  return (
    <div className="fav-rd" style={{ minHeight: '100vh', background: bg, padding: '8px 20px 120px' }}>
      <style>{`
        .fav-rd .fv-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 0 14px;}
        .fav-rd .fv-logo{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:500;letter-spacing:0;color:#0A0A0A;text-transform:lowercase;}
        .fav-rd .fv-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,#0A0A0A);color:#D5FE61;display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:14px;font-weight:700;}
        .fav-rd .fv-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#D5FE61;border:2px solid var(--canvas);}
        .fav-rd .fv-title{margin:6px 2px 18px;font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:26px;font-weight:700;letter-spacing:-0.6px;color:#0A0A0A;}
        .fav-rd .fv-list{display:flex;flex-direction:column;gap:10px;}
        .fav-rd .fv-item{position:relative;padding:14px;border:1px solid var(--glass-border);border-radius:22px;background:#fff;box-shadow:var(--glass-shadow);overflow:hidden;}
        .fav-rd .fv-del{position:absolute;top:10px;right:10px;z-index:3;width:28px;height:28px;border:0;border-radius:50%;background:rgba(10,10,10,0.06);color:#0A0A0A;display:grid;place-items:center;cursor:pointer;}
        .fav-rd .fv-del:active{transform:scale(0.9);}
        .fav-rd .fv-del svg{fill:none;stroke:#0A0A0A;stroke-width:1.6;}
        .fav-rd .fv-body{min-width:0;display:flex;flex-direction:column;gap:8px;padding-right:44px;}
        .fav-rd .fv-brand{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;}
        .fav-rd .fv-name{font-size:14px;font-weight:700;line-height:1.22;letter-spacing:-0.15px;color:#0A0A0A;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .fav-rd .fv-price{font-size:12.5px;font-weight:800;color:#0A0A0A;}
        .fav-rd .fv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px;}
        .fav-rd .fv-cta{width:100%;height:44px;border:0;border-radius:999px;background:#D5FE61;color:#000;font-family:var(--font-inter),sans-serif;font-weight:700;font-size:14px;letter-spacing:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(213,254,97,0.26);transition:transform .14s ease,box-shadow .14s ease;margin-top:2px;}
        .fav-rd .fv-cta:active{transform:scale(0.985);box-shadow:0 4px 10px rgba(213,254,97,0.22);}
        .fav-rd .fv-cta.in{background:#0A0A0A;color:#fff;}
        .fav-rd .fv-feedback{width:100%;height:44px;border:1px solid var(--glass-border);border-radius:999px;background:#fff;color:#0A0A0A;font-family:var(--font-inter),sans-serif;font-weight:700;font-size:13px;letter-spacing:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:transform .14s ease,background .14s ease;margin-top:2px;}
        .fav-rd .fv-feedback:active{transform:scale(0.985);}
        .fav-rd .fv-feedback.done{background:#F3F4F6;color:#6B7280;}
        .fav-rd .fv-feedback svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}
        .fav-rd .fv-feedback-options{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:2px;}
        .fav-rd .fv-feedback-option{height:36px;border:1px solid rgba(10,10,10,0.08);border-radius:999px;background:#F8F8F6;color:#0A0A0A;font-size:12px;font-weight:700;cursor:pointer;}
        .fav-rd .fv-feedback-option:disabled{opacity:.58;cursor:not-allowed;}
        .fav-rd .fv-empty{text-align:center;padding:60px 20px;background:#fff;border:1px solid var(--glass-border);border-radius:24px;margin-top:24px;}
        .fav-rd .fv-empty-cta{display:inline-block;background:#0A0A0A;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-family:var(--font-inter),sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.1px;box-shadow:0 10px 24px rgba(10,10,10,0.18);transition:transform .14s ease;}
        .fav-rd .fv-empty-cta:active{transform:scale(0.98);}
        @media (max-width:360px){.fav-rd .fv-actions{grid-template-columns:1fr;}}
      `}</style>

      <div className="fv-topbar">
        <div className="fv-logo">skiniq</div>
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
            const feedback = feedbackByProduct[item.product.id] ?? item.feedback;
            const hasFeedback = feedback && feedback !== 'not_bought';
            const priceLabel = formatPriceFrom(item.product.priceFrom)?.replace(' ₽', ' руб');
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
                  {priceLabel && <div className="fv-price">{priceLabel}</div>}
                  <div className="fv-actions">
                    <button
                      className={`fv-cta${inCart ? ' in' : ''}`}
                      onClick={() => handleAddToCart(item.product.id)}
                      disabled={addToCart.isPending}
                    >
                      {inCart ? 'В корзине' : 'В корзину'}
                    </button>
                    <button
                      type="button"
                      className={`fv-feedback${hasFeedback ? ' done' : ''}`}
                      onClick={() => setFeedbackOpenId((prev) => prev === item.product.id ? null : item.product.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {hasFeedback ? 'Отзыв учтён' : 'Оставить отзыв'}
                    </button>
                  </div>
                  {feedbackOpenId === item.product.id && (
                    <div className="fv-feedback-options" aria-label="Отзыв о средстве">
                      <button className="fv-feedback-option" disabled={feedbackBusyId === item.product.id} onClick={() => handleFeedback(item.product.id, 'bought_love')}>Отлично</button>
                      <button className="fv-feedback-option" disabled={feedbackBusyId === item.product.id} onClick={() => handleFeedback(item.product.id, 'bought_ok')}>Норм</button>
                      <button className="fv-feedback-option" disabled={feedbackBusyId === item.product.id} onClick={() => handleFeedback(item.product.id, 'bought_bad')}>Не подошло</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
