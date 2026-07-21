// app/(miniapp)/cart-new/page.tsx
// Страница корзины — редизайн «Корзина»

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart, useRemoveFromCart } from '@/hooks/useCart';
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from '@/hooks/useWishlist';
import type { CartResponse } from '@/lib/api-types';
import { TabLoadingShell } from '@/components/TabLoadingShell';
import { ProfileAvatarButton } from '@/components/ProfileAvatarButton';
import { withAffiliate, isGoldapple, affiliateRel, AFFILIATE_ERID, AFFILIATE_DISCLOSURE } from '@/lib/affiliate';
import { formatPriceFrom } from '@/lib/price-display';
import toast from 'react-hot-toast';

export const dynamic = 'force-dynamic';

interface CartItem {
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
  quantity: number;
  createdAt: string;
}

function getStore(p: CartItem['product']): { url: string; name: string } | null {
  const m = (p.marketLinks as any) || {};
  if (m.goldapple) return { url: m.goldapple, name: 'Золотое Яблоко' };
  if (p.link && isGoldapple(p.link)) return { url: p.link, name: 'Золотое Яблоко' };
  if (m.ym) return { url: m.ym, name: 'Яндекс Маркет' };
  if (m.ozon) return { url: m.ozon, name: 'Ozon' };
  if (m.wildberries) return { url: m.wildberries, name: 'Wildberries' };
  if (m.apteka) return { url: m.apteka, name: 'Аптека' };
  if (p.link) {
    try {
      const host = new URL(p.link).hostname.replace(/^www\./, '');
      if (host.endsWith('market.yandex.ru')) return { url: p.link, name: 'Яндекс Маркет' };
      if (host.endsWith('ozon.ru')) return { url: p.link, name: 'Ozon' };
      if (host.endsWith('wildberries.ru')) return { url: p.link, name: 'Wildberries' };
      if (host.endsWith('apteka.ru')) return { url: p.link, name: 'Аптека' };
    } catch {}
    return { url: p.link, name: 'Магазин' };
  }
  return null;
}

// Партнёрская логика Goldapple вынесена в lib/affiliate.ts (единый источник правды
// для корзины и избранного: redav-редирект, erid, маркировка ФЗ-38).

function resolveCartIcon(product: CartItem['product']): string {
  const n = `${product.brand?.name || ''} ${product.name || ''}`.toLowerCase();
  if (/spf|sunscreen|санскрин|солнцезащит/.test(n)) return '/icons/clean/spf_true.png';
  if (/cleanser|cleansing|пенк|гел[ьяе]\s*для|умыван|foam|wash|очищ|очист/.test(n)) return '/icons/clean/cleanser_true.png';
  if (/balm|бальзам|для\s+губ|lip\b/.test(n)) return '/icons/clean/lipbalm_true.png';
  if (/oil|масл/.test(n)) return '/icons/oil_green.png';
  if (/mask|маск/.test(n)) return '/icons/mask_green.png';
  if (/retinol|ретинол|aha|bha|acid|кислот|пилинг|peel|bpo|benzoyl|бензоил|азелаин/.test(n)) return '/icons/clean/treatment_true.png';
  if (/serum|сыворотк|essence|эссенц/.test(n)) return '/icons/clean/serum_true.png';
  if (/toner|тоник|тонер|mist/.test(n)) return '/icons/clean/toner_true.png';
  return '/icons/clean/cream_true.png';
}

function CartProductThumb({ product }: { product: CartItem['product'] }) {
  const [failed, setFailed] = useState(false);
  const showIcon = !product.imageUrl || failed;

  return (
    <div className={`crd-thumb ${showIcon ? 'crd-thumb-icon' : ''}`}>
      {showIcon ? (
        <img
          className="crd-thumb-icon-img"
          src={resolveCartIcon(product)}
          alt=""
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <img
          className="crd-thumb-img"
          src={product.imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function CartPageContent() {
  const router = useRouter();
  const { data: cartData, isPending: cartPending, isError: cartError } = useCart();
  const { data: wishlistData } = useWishlist();
  const removeFromCart = useRemoveFromCart();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const [wishlistBusyId, setWishlistBusyId] = useState<number | null>(null);

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

  const wishlistProductIds = new Set<number>(
    (wishlistData?.items || [])
      .map((item: any) => item.product?.id ?? item.productId)
      .filter((id: unknown): id is number => typeof id === 'number')
  );

  const handleToggleWishlist = async (productId: number) => {
    if (wishlistBusyId === productId) return;
    setWishlistBusyId(productId);
    try {
      if (wishlistProductIds.has(productId)) {
        await removeFromWishlist.mutateAsync(productId);
        toast.success('Убрано из избранного');
      } else {
        await addToWishlist.mutateAsync(productId);
        toast.success('Добавлено в избранное');
      }
    } catch {
      toast.error('Не удалось обновить избранное');
    } finally {
      setWishlistBusyId(null);
    }
  };

  // Маркировку ФЗ-38 показываем только если в корзине есть рекламная (goldapple) ссылка.
  const hasSponsored = cartItems.some((i) => {
    const s = getStore(i.product);
    return !!s && isGoldapple(s.url);
  });

  const bg = 'var(--canvas)';

  const loading = cartPending || (!cartError && cartData === undefined);

  if (loading) {
    return <TabLoadingShell eyebrow="Средства из плана" title="Корзина" background={bg} variant="cart-list" />;
  }

  return (
    <div className="cart-rd" style={{ minHeight: '100vh', background: bg, padding: '8px 20px 120px' }}>
      <style>{`
        .cart-rd .crd-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 0 14px;}
        .cart-rd .crd-logo{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:18px;font-weight:500;letter-spacing:0;color:#0A0A0A;text-transform:lowercase;}
        .cart-rd .crd-avatar{position:relative;width:40px;height:40px;border:0;padding:0;border-radius:50%;background:linear-gradient(135deg,#2A2A2A,#0A0A0A);color:#D5FE61;display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 6px 18px rgba(10,10,10,0.18);font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:14px;font-weight:700;}
        .cart-rd .crd-avatar::after{content:"";position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#D5FE61;border:2px solid var(--canvas);}
        .cart-rd .crd-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 2px 18px;}
        .cart-rd .crd-eyebrow{font-family:var(--font-inter),-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:7px;}
        .cart-rd .crd-title{margin:0;font-family:var(--font-unbounded),'Unbounded',sans-serif;font-size:30px;font-weight:700;letter-spacing:-0.9px;line-height:1.08;color:#0A0A0A;}
        .cart-rd .crd-clear{border:0;background:transparent;color:#6B7280;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:-0.1px;}
        .cart-rd .crd-list{display:flex;flex-direction:column;gap:12px;}
        .cart-rd .crd-item{position:relative;padding:16px;border:1px solid var(--glass-border);border-radius:28px;background:#fff;box-shadow:var(--glass-shadow-lg);overflow:hidden;}
        .cart-rd .crd-del{position:absolute;top:14px;right:14px;z-index:3;width:34px;height:34px;border:0;border-radius:50%;background:rgba(10,10,10,0.06);color:#6B7280;padding:0;display:grid;place-items:center;cursor:pointer;transition:transform .14s ease,background .14s ease;}
        .cart-rd .crd-del svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .cart-rd .crd-del:active{transform:scale(0.92);}
        .cart-rd .crd-fav-icon{position:absolute;top:54px;right:14px;z-index:3;width:34px;height:34px;border:1px solid rgba(10,10,10,0.08);border-radius:50%;background:#F3F4F6;color:#0A0A0A;padding:0;display:grid;place-items:center;cursor:pointer;transition:transform .14s ease,background .14s ease,color .14s ease,border-color .14s ease;}
        .cart-rd .crd-fav-icon:active:not(:disabled){transform:scale(0.92);}
        .cart-rd .crd-fav-icon:disabled{opacity:0.58;cursor:not-allowed;}
        .cart-rd .crd-fav-icon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}
        .cart-rd .crd-fav-icon.in{background:#0A0A0A;color:#D5FE61;border-color:#0A0A0A;}
        .cart-rd .crd-fav-icon.in svg{fill:currentColor;}
        .cart-rd .crd-main{display:flex;align-items:center;gap:14px;min-width:0;padding-right:42px;margin-bottom:14px;}
        .cart-rd .crd-thumb{position:relative;width:82px;height:82px;border-radius:20px;background:#fff;border:1px solid var(--glass-border);flex:0 0 auto;overflow:hidden;}
        .cart-rd .crd-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .cart-rd .crd-thumb-icon{background:transparent;border-color:transparent;overflow:visible;}
        .cart-rd .crd-thumb-icon::before{content:"";position:absolute;inset:3px 2px 0;border-radius:46% 54% 50% 50%;background:radial-gradient(circle at 50% 52%,rgba(213,254,97,0.88) 0%,rgba(213,254,97,0.58) 42%,rgba(213,254,97,0.18) 62%,transparent 78%);filter:blur(7px);transform:scale(1.04);z-index:0;pointer-events:none;}
        .cart-rd .crd-thumb-icon-img{position:relative;z-index:1;display:block;width:78%;height:78%;margin:11% auto 0;object-fit:contain;filter:drop-shadow(0 5px 12px rgba(10,10,10,0.24)) drop-shadow(0 0 1px rgba(10,10,10,0.22));}
        .cart-rd .crd-copy{min-width:0;display:flex;flex-direction:column;gap:6px;}
        .cart-rd .crd-brand{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;}
        .cart-rd .crd-name{font-size:18px;font-weight:800;line-height:1.18;letter-spacing:-0.35px;color:#0A0A0A;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
        .cart-rd .crd-store-row{display:flex;align-items:center;gap:7px;min-width:0;margin-top:2px;}
        .cart-rd .crd-store-dot{width:7px;height:7px;border-radius:50%;background:#D5FE61;box-shadow:0 0 0 3px rgba(213,254,97,0.24);flex:0 0 auto;}
        .cart-rd .crd-store{font-size:12px;font-weight:700;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .cart-rd .crd-price{font-size:12.5px;font-weight:800;color:#0A0A0A;margin-top:1px;}
        .cart-rd .crd-qty{font-size:11px;font-weight:700;color:#6B7280;}
        .cart-rd .crd-actions{display:grid;grid-template-columns:1fr;gap:8px;align-items:center;}
        .cart-rd .crd-cta{width:100%;height:44px;border:0;border-radius:999px;background:#D5FE61;color:#000;font-family:var(--font-inter),sans-serif;font-weight:800;font-size:14px;letter-spacing:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;box-shadow:0 10px 22px rgba(213,254,97,0.3);transition:transform .14s ease,box-shadow .14s ease;}
        .cart-rd .crd-cta svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}
        .cart-rd .crd-cta:active{transform:scale(0.985);box-shadow:0 4px 10px rgba(213,254,97,0.22);}
        .cart-rd .crd-link-note{min-height:44px;border-radius:18px;background:rgba(10,10,10,0.04);border:1px solid rgba(10,10,10,0.06);color:#6B7280;font-size:11px;font-weight:650;line-height:1.25;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 12px;}
        .cart-rd .crd-empty{text-align:center;padding:60px 20px;background:#fff;border:1px solid var(--glass-border);border-radius:24px;margin-top:24px;}
        .cart-rd .crd-empty-cta{display:inline-block;background:#0A0A0A;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-family:var(--font-inter),sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.1px;box-shadow:0 10px 24px rgba(10,10,10,0.18);transition:transform .14s ease;}
        .cart-rd .crd-empty-cta:active{transform:scale(0.98);}
        .cart-rd .crd-ad-mark{grid-column:1/-1;margin:-1px 2px 0;font-size:10px;line-height:1.35;color:#6B7280;letter-spacing:0;text-align:left;user-select:text;}
        .cart-rd .crd-ad-mark strong{font-weight:800;color:#0A0A0A;}
        .cart-rd .crd-erid{margin:14px 4px 4px;padding:0;background:transparent;border:0;font-size:10px;line-height:1.45;color:#6B7280;letter-spacing:0;text-align:center;user-select:text;}
        .cart-rd .crd-vpn{display:flex;align-items:flex-start;gap:11px;margin:0 2px 16px;padding:13px 15px;border-radius:20px;background:#fff;border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);}
        .cart-rd .crd-vpn-ic{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:#0A0A0A;display:grid;place-items:center;}
        .cart-rd .crd-vpn-ic svg{width:16px;height:16px;fill:none;stroke:#D5FE61;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
        .cart-rd .crd-vpn-tx{font-size:12px;line-height:1.42;color:#374151;letter-spacing:-0.1px;}
        .cart-rd .crd-vpn-tx strong{font-weight:800;color:#0A0A0A;}
        @media (max-width:360px){
          .cart-rd .crd-actions{grid-template-columns:1fr;}
          .cart-rd .crd-main{padding-right:38px;}
        }
      `}</style>

      <div className="crd-topbar">
        <div className="crd-logo">skiniq</div>
        <ProfileAvatarButton className="crd-avatar" />
      </div>

      <div className="crd-header">
        <div>
          <div className="crd-eyebrow">Средства из плана</div>
          <h1 className="crd-title">Корзина</h1>
        </div>
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
          {/* Информер: РФ-магазины (Золотое Яблоко, Яндекс Маркет) часто не открываются
              или отдают неверные цены при включённом VPN. Показываем, когда в корзине есть товары. */}
          <div className="crd-vpn" role="note">
            <span className="crd-vpn-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /></svg>
            </span>
            <div className="crd-vpn-tx">
              <strong>Отключите VPN перед переходом в магазин.</strong> Российские магазины (Золотое Яблоко, Яндекс Маркет) могут не открыться или показать неверные цены при включённом VPN.
            </div>
          </div>
          <div className="crd-list">
            {cartItems.map((item) => {
              const store = getStore(item.product);
              const affiliate = store ? withAffiliate(store.url) : null;
              const inWishlist = wishlistProductIds.has(item.product.id);
              const wishlistBusy = wishlistBusyId === item.product.id;
              const priceLabel = formatPriceFrom(item.product.priceFrom)?.replace(' ₽', ' руб');
              return (
                <div className="crd-item" key={item.id}>
                  <button className="crd-del" aria-label="Удалить" onClick={() => handleRemove(item.product.id)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`crd-fav-icon ${inWishlist ? 'in' : ''}`}
                    disabled={wishlistBusy}
                    onClick={() => handleToggleWishlist(item.product.id)}
                    aria-label={inWishlist ? 'Убрать из избранного' : 'В избранное'}
                    title={inWishlist ? 'В избранном' : 'В избранное'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 21s-7-4.5-9.5-8.5A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6.5C19 16.5 12 21 12 21z" />
                    </svg>
                  </button>
                  <div className="crd-main">
                    <CartProductThumb product={item.product} />
                    <div className="crd-copy">
                      <div className="crd-brand">{item.product.brand?.name || 'Unknown'}</div>
                      <div className="crd-name">{item.product.name}</div>
                      {store && (
                        <div className="crd-store-row">
                          <span className="crd-store-dot" aria-hidden="true" />
                          <span className="crd-store">{store.name}</span>
                          {item.quantity > 1 && <span className="crd-qty">× {item.quantity}</span>}
                        </div>
                      )}
                      {!store && item.quantity > 1 && <span className="crd-qty">× {item.quantity}</span>}
                      {priceLabel && <div className="crd-price">{priceLabel}</div>}
                    </div>
                  </div>
                  <div className="crd-actions">
                    {store && affiliate ? (
                      <a
                        className="crd-cta"
                        href={affiliate.href}
                        target="_blank"
                        rel={affiliateRel(affiliate.sponsored)}
                      >
                        В магазин
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </a>
                    ) : (
                      <div className="crd-link-note">Скоро появится ссылка на магазин</div>
                    )}
                    {affiliate?.sponsored && (
                      <div className="crd-ad-mark">Реклама · <strong>erid: {AFFILIATE_ERID}</strong></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasSponsored && (
            <div className="crd-erid">{AFFILIATE_DISCLOSURE}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function CartNewPage() {
  return <CartPageContent />;
}
