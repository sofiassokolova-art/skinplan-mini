// app/(miniapp)/cart-new/page.tsx
// Страница корзины — редизайн «Корзина»

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart, useRemoveFromCart } from '@/hooks/useCart';
import type { CartResponse } from '@/lib/api-types';
import toast from 'react-hot-toast';

export const dynamic = 'force-dynamic';

interface CartItem {
  id: string;
  product: {
    id: number;
    name: string;
    brand: { id: number; name: string };
    price: number | null;
    imageUrl: string | null;
    link: string | null;
    marketLinks: any;
  };
  quantity: number;
  createdAt: string;
}

function getStore(p: CartItem['product']): { url: string; name: string } | null {
  const m = (p.marketLinks as any) || {};
  if (m.ozon) return { url: m.ozon, name: 'Ozon' };
  if (m.wildberries) return { url: m.wildberries, name: 'Wildberries' };
  if (m.apteka) return { url: m.apteka, name: 'Аптека' };
  if (p.link) return { url: p.link, name: 'Магазин' };
  return null;
}

function CartPageContent() {
  const router = useRouter();
  const { data: cartData, isLoading: loading } = useCart();
  const removeFromCart = useRemoveFromCart();

  const cartItems: CartItem[] = (cartData?.items || []).map((item: CartResponse['items'][0]) => ({
    id: item.id,
    product: item.product,
    quantity: item.quantity,
    createdAt: item.createdAt,
  }));

  const handleRemove = async (productId: number) => {
    try {
      await removeFromCart.mutateAsync(productId);
      toast.success('Удалено из корзины');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const handleClearAll = async () => {
    try {
      await Promise.all(cartItems.map((i) => removeFromCart.mutateAsync(i.product.id)));
      toast.success('Корзина очищена');
    } catch {
      toast.error('Не удалось очистить');
    }
  };

  const firstStore = cartItems.map((i) => getStore(i.product)).find(Boolean) || null;

  const bg =
    'radial-gradient(70% 30% at 0% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),' +
    'radial-gradient(58% 24% at 100% 18%, rgba(255,224,188,0.5) 0%, transparent 70%),' +
    'radial-gradient(72% 28% at 0% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),' +
    'radial-gradient(80% 32% at 100% 92%, rgba(213,254,97,0.4) 0%, transparent 62%),' +
    '#F4F2EE';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, backgroundAttachment: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '15px', color: '#6B7280' }}>Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="cart-rd" style={{ minHeight: '100vh', background: bg, backgroundAttachment: 'fixed', padding: '8px 20px', paddingBottom: cartItems.length > 0 ? '210px' : '120px' }}>
      <style>{`
        .cart-rd .crd-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 0 14px;}
        .cart-rd .crd-logo{font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.4px;color:#0A0A0A;}
        .cart-rd .crd-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,#0A0A0A);color:#D5FE61;display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:14px;font-weight:700;}
        .cart-rd .crd-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#D5FE61;border:2px solid #F4F2EE;}
        .cart-rd .crd-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 2px 18px;}
        .cart-rd .crd-title{margin:0;font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:26px;font-weight:700;letter-spacing:-0.6px;color:#0A0A0A;}
        .cart-rd .crd-clear{border:0;background:transparent;color:#6B7280;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:-0.1px;}
        .cart-rd .crd-list{display:flex;flex-direction:column;gap:10px;}
        .cart-rd .crd-item{position:relative;display:grid;grid-template-columns:76px minmax(0,1fr);gap:14px;padding:12px;border:1px solid rgba(255,255,255,0.7);border-radius:22px;background:rgba(255,255,255,0.62);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);box-shadow:0 8px 22px rgba(0,0,0,0.04);overflow:hidden;}
        .cart-rd .crd-thumb{width:76px;height:100%;min-height:96px;display:grid;place-items:center;}
        .cart-rd .crd-thumb img{max-width:64px;max-height:88px;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,0.1));}
        .cart-rd .crd-del{position:absolute;top:10px;right:10px;z-index:3;width:28px;height:28px;border:0;border-radius:50%;background:rgba(10,10,10,0.06);color:#0A0A0A;display:grid;place-items:center;cursor:pointer;}
        .cart-rd .crd-del:active{transform:scale(0.9);}
        .cart-rd .crd-body{min-width:0;display:flex;flex-direction:column;gap:6px;padding-right:24px;}
        .cart-rd .crd-brand{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;}
        .cart-rd .crd-name{font-size:14px;font-weight:700;line-height:1.22;letter-spacing:-0.15px;color:#0A0A0A;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .cart-rd .crd-meta{display:flex;align-items:center;gap:8px;}
        .cart-rd .crd-qty{font-size:11px;color:#9CA3AF;}
        .cart-rd .crd-store{font-size:10.5px;font-weight:600;color:#6B7280;}
        .cart-rd .crd-store::before{content:"\\2197 ";color:#9CA3AF;}
        .cart-rd .crd-cta{width:100%;height:44px;border:0;border-radius:0;background:#D5FE61;color:#000;font-family:var(--font-inter),sans-serif;font-weight:400;font-size:13px;text-transform:uppercase;letter-spacing:0.02em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;transition:transform .15s;}
        .cart-rd .crd-cta:active{transform:scale(0.98);}
        .cart-rd .crd-empty{text-align:center;padding:60px 20px;background:rgba(255,255,255,0.62);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.7);border-radius:24px;margin-top:24px;}
        .cart-rd .crd-empty-cta{display:inline-block;background:#0A0A0A;color:#D5FE61;padding:14px 28px;border-radius:0;text-decoration:none;font-family:var(--font-inter),sans-serif;font-size:13px;font-weight:400;text-transform:uppercase;letter-spacing:0.02em;}
        .cart-rd .crd-checkout{position:fixed;left:0;right:0;bottom:96px;padding:0 20px;z-index:900;display:flex;justify-content:center;}
        .cart-rd .crd-checkout-inner{width:100%;max-width:420px;}
        .cart-rd .crd-checkout-btn{width:100%;height:52px;border:0;border-radius:0;background:#0A0A0A;color:#fff;font-family:var(--font-inter),sans-serif;font-weight:400;font-size:15px;text-transform:uppercase;letter-spacing:0.02em;cursor:pointer;}
        .cart-rd .crd-checkout-btn:active{transform:scale(0.99);}
      `}</style>

      <div className="crd-topbar">
        <div className="crd-logo">SkinIQ</div>
        <button className="crd-avatar" aria-label="Профиль" onClick={() => router.push('/profile')}>С</button>
      </div>

      <div className="crd-header">
        <h1 className="crd-title">Корзина</h1>
        {cartItems.length > 0 && <button className="crd-clear" onClick={handleClearAll}>Очистить</button>}
      </div>

      {cartItems.length === 0 ? (
        <div className="crd-empty">
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0A0A0A', marginBottom: '8px' }}>Корзина пуста</h3>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>Добавьте средства из избранного или плана</p>
          <Link href="/plan" className="crd-empty-cta">Открыть план</Link>
        </div>
      ) : (
        <>
          <div className="crd-list">
            {cartItems.map((item) => {
              const store = getStore(item.product);
              return (
                <div className="crd-item" key={item.id}>
                  <button className="crd-del" aria-label="Удалить" onClick={() => handleRemove(item.product.id)}>
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                  <div className="crd-thumb">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ fontSize: '28px' }}>🧴</div>
                    )}
                  </div>
                  <div className="crd-body">
                    <div className="crd-brand">{item.product.brand?.name || 'Unknown'}</div>
                    <div className="crd-name">{item.product.name}</div>
                    <div className="crd-meta">
                      {item.quantity > 1 && <span className="crd-qty">× {item.quantity}</span>}
                    </div>
                    {store && <div className="crd-store">{store.name}</div>}
                    {store ? (
                      <a className="crd-cta" href={store.url} target="_blank" rel="noopener noreferrer">
                        В магазин
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      </a>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Ссылка не найдена</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="crd-checkout">
            <div className="crd-checkout-inner">
              {firstStore && (
                <button
                  className="crd-checkout-btn"
                  onClick={() => {
                    cartItems.forEach((item) => {
                      const s = getStore(item.product);
                      if (s) window.open(s.url, '_blank');
                    });
                  }}
                >
                  Купить всё ({cartItems.length})
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartNewPage() {
  return <CartPageContent />;
}
