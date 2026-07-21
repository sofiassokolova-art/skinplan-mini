// app/(miniapp)/plan/plan-page-v2.tsx
// Новый компонент страницы плана: self-fetching, читает /api/plan/page-context
// и рендерит всё на основе PlanPageContext.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { invalidatePlanWarmCache } from '@/lib/plan-warm-cache';
import toast from 'react-hot-toast';
import { PaymentGate } from '@/components/PaymentGate';
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { resolvePlanPaywall, resolvePlanRetakeHref, hasWinbackOfferParam } from '@/lib/paywall-product';
import { useAddManyToCart, useAddToCart, useRemoveFromCart } from '@/hooks/useCart';
import type {
  PlanPageContext,
  ProductCard,
  PhaseUI,
  ProfileCard,
  ExpertNote,
} from '@/lib/plan-page/types';
import type { PlanPhases } from '@/lib/plan-types';

interface ProductActionState {
  /** productId, по которому сейчас идёт запрос (чтобы блокировать повторные нажатия) */
  busyId: number | null;
}

interface LoadContextOptions {
  showLoader?: boolean;
  keepStaleOnError?: boolean;
}

export function PlanPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [context, setContext] = useState<PlanPageContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ProductActionState>({ busyId: null });
  // Замена продукта: какой продукт сейчас открыт в модалке подбора аналогов.
  const [replaceTarget, setReplaceTarget] = useState<ProductCard | null>(null);
  // Фидбек по плану можно отправить только один раз (см. handleFeedback).
  const [feedbackSent, setFeedbackSent] = useState(false);
  const addToCartMutation = useAddToCart();
  const addManyToCartMutation = useAddManyToCart();
  const removeFromCartMutation = useRemoveFromCart();
  // Перепрохождение анкеты: меняет тексты в PaymentGate (как в plan-client-new)
  const [isRetaking, setIsRetaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getIsRetakingQuiz, getFullRetakeFromHome } = await import('@/lib/user-preferences');
        const [isRetakingQuiz, fullRetakeFromHome] = await Promise.all([
          getIsRetakingQuiz(),
          getFullRetakeFromHome(),
        ]);
        if (!cancelled) {
          setIsRetaking(Boolean(isRetakingQuiz || fullRetakeFromHome));
        }
      } catch (err) {
        if (!cancelled) {
          clientLogger.warn('PlanPageV2: could not load retaking status', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Узнаём, оставлял ли пользователь уже отзыв о плане — тогда форму не показываем.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await api.getLastPlanFeedback()) as { lastFeedback?: unknown } | null;
        if (!cancelled && res?.lastFeedback) {
          setFeedbackSent(true);
        }
      } catch (err) {
        if (!cancelled) {
          clientLogger.warn('PlanPageV2: could not load last feedback', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadContext = useCallback(async (options: LoadContextOptions = {}) => {
    const showLoader = options.showLoader ?? true;
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);
      const res = await api.getPlanPageContext();
      if (res.state === 'no_plan' || !res.context) {
        router.replace('/quiz');
        return;
      }
      setContext(res.context);
    } catch (err: any) {
      clientLogger.error('Failed to load plan page context', err);
      if (options.keepStaleOnError) {
        return;
      }
      setError('Не удалось загрузить план. Попробуйте ещё раз.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const handleToggleWishlist = useCallback(async (product: ProductCard) => {
    if (actionState.busyId === product.id) return;
    setActionState({ busyId: product.id });
    try {
      if (product.state.inWishlist) {
        await api.removeFromWishlist(product.id);
        toast.success('Убрано из избранного');
      } else {
        await api.addToWishlist(product.id);
        toast.success('Добавлено в избранное');
      }
      await loadContext({ showLoader: false, keepStaleOnError: true });
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось обновить избранное');
    } finally {
      setActionState({ busyId: null });
    }
  }, [actionState.busyId, loadContext]);

  const handleToggleCart = useCallback(async (product: ProductCard) => {
    if (actionState.busyId === product.id || addManyToCartMutation.isPending) return;
    setActionState({ busyId: product.id });
    try {
      if (product.state.inCart) {
        await removeFromCartMutation.mutateAsync(product.id);
        toast.success('Убрано из корзины');
      } else {
        await addToCartMutation.mutateAsync({ productId: product.id, quantity: 1 });
        toast.success('В корзине');
      }
      await loadContext({ showLoader: false, keepStaleOnError: true });
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось обновить корзину');
    } finally {
      setActionState({ busyId: null });
    }
  }, [actionState.busyId, addManyToCartMutation.isPending, addToCartMutation, removeFromCartMutation, loadContext]);

  const handleAddAllToCart = useCallback(async (products: ProductCard[]) => {
    if (actionState.busyId !== null || addManyToCartMutation.isPending) return;

    const productIds = products
      .filter((product) => !product.state.inCart)
      .map((product) => product.id);

    if (productIds.length === 0) {
      toast.success('Все средства уже в корзине');
      return;
    }

    try {
      await addManyToCartMutation.mutateAsync(productIds);
      toast.success(`Добавлено в корзину: ${productIds.length}`);
      await loadContext({ showLoader: false, keepStaleOnError: true });
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось добавить все средства');
    }
  }, [actionState.busyId, addManyToCartMutation, loadContext]);

  const handleReplaceClick = useCallback((product: ProductCard) => {
    // Открываем модалку подбора аналогов (ReplaceProductModal сам тянет
    // живые альтернативы из /api/products/alternatives и применяет замену).
    setReplaceTarget(product);
  }, []);

  const handleFeedback = useCallback(async (isPositive: boolean) => {
    // Отзыв можно отправить только один раз.
    if (feedbackSent) return;
    try {
      await api.submitFeedback(isPositive, isPositive ? [] : ['plan_does_not_fit']);
      setFeedbackSent(true);
      toast.success(isPositive ? 'Спасибо за фидбек!' : 'Передадим в команду');
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось отправить фидбек');
    }
  }, [feedbackSent]);

  if (loading) {
    return <PlanV2LoadingShell />;
  }

  if (error || !context) {
    return (
      <div className="pv2-error app-bottom-nav-clearance">
        <p>{error ?? 'План не найден'}</p>
        <button className="btn-primary" onClick={() => void loadContext()}>Обновить</button>
        <style jsx>{`
          .pv2-error {
            min-height: 100svh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: var(--canvas);
            font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
            gap: 16px;
            padding: 20px 20px var(--bottom-nav-clearance);
          }
          .pv2-error p { color: var(--ink); font-size: 14px; }
          .pv2-error button {
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pv2-root">
      <PlanV2Styles />

      {/* 1. Topbar */}
      <div className="pv2-topbar">
        <div className="pv2-logo">skiniq</div>
      </div>

      {/* 2. Personal heading */}
      <h1 className="pv2-personal-heading">{context.heading}</h1>

      {/*
        PaymentGate оборачивает платный контент плана.
        До оплаты: показывается paywall + блюр контента (и навигация скрыта через usePaywallVisibility).
        После оплаты: контент разблокирован, URL очищается от paywall/blur → появляется нижняя навигация.
        Точно такой же паттерн, как в plan-client-new.tsx и home/page.tsx, чтобы пейволл
        не «протекал» только на /home.
      */}
      <PaymentGate
        {...resolvePlanPaywall({
          expired: context.planExpired,
          winbackOffer: hasWinbackOfferParam(searchParams?.toString()),
        })}
        isRetaking={isRetaking}
        retakeCta={{
          text: 'Изменились цели? Перепройти анкету',
          href: resolvePlanRetakeHref(context.planExpired),
        }}
        onPaymentComplete={() => {
          clientLogger.log('✅ Payment completed on plan page (V2)');
          const q = new URLSearchParams(searchParams?.toString() || '');
          q.delete('paywall');
          q.delete('blur');
          const newSearch = q.toString();
          router.replace(newSearch ? `/plan?${newSearch}` : '/plan');
        }}
      >
        {/* 3. Phase + Streak */}
        <div className="pv2-double-row">
          <div className="glass-card-md pv2-mini-card">
            <div className="pv2-mini-label">Текущая фаза</div>
            <div className="pv2-mini-value">{context.hero.phaseLabel}</div>
            <div className="pv2-mini-sub">
              День {context.hero.dayInPhase} из {context.hero.daysInPhase}
            </div>
          </div>
          <div className="glass-card-md pv2-mini-card pv2-mini-dark">
            <div className="pv2-mini-label">skiniq streak</div>
            <div className="pv2-mini-value">{context.streak.label}</div>
            <div className="pv2-mini-sub">дни подряд с отметкой ухода</div>
          </div>
        </div>

        {/* 4. Score */}
        <ScoreCard
          score={context.skinScore.score}
          label={context.skinScore.label}
          description={context.skinScore.description}
          onHintClick={() => router.push('/home')}
        />

        {/* 5. Profile carousel */}
        <ProfileCarousel cards={context.profileCards} />

        {/* 6. Phases + Products */}
        <PlanPhasesProductsSection
          phases={context.phases}
          products={context.products}
          busyId={actionState.busyId}
          bulkAdding={addManyToCartMutation.isPending}
          onReplace={handleReplaceClick}
          onToggleWishlist={handleToggleWishlist}
          onToggleCart={handleToggleCart}
          onAddAllToCart={handleAddAllToCart}
        />

        {/* 7. Expert notes */}
        <ExpertNotesCard
          notes={context.expertNotes}
          onRetakeQuiz={() => {
            invalidatePlanWarmCache();
            // Контент плана виден только после оплаты → это всегда «платил» ветка:
            // экран выбора тем, а не рестарт анкеты с нуля.
            router.push(resolvePlanRetakeHref(true));
          }}
        />

        {/* 8. Feedback */}
        <FeedbackSection onSubmit={handleFeedback} submitted={feedbackSent} />

        <div style={{ height: 100 }} />
      </PaymentGate>

      <ReplaceProductModal
        isOpen={replaceTarget !== null}
        product={
          replaceTarget
            ? {
                id: replaceTarget.id,
                name: replaceTarget.name,
                brand: { name: replaceTarget.brand },
                price: replaceTarget.price,
                imageUrl: replaceTarget.imageUrl,
              }
            : null
        }
        onClose={() => setReplaceTarget(null)}
        onReplace={() => {
          setReplaceTarget(null);
          // Перечитываем контекст, чтобы в списке появилась замена.
          void loadContext({ keepStaleOnError: true });
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function PlanV2LoadingShell() {
  return (
    <div className="pv2-root pv2-loading-root">
      <PlanV2Styles />
      <div style={{ minHeight: '100svh' }} />
    </div>
  );
}

function ScoreCard({ score, label, description, onHintClick }: { score: number; label: string; description: string; onHintClick?: () => void }) {
  return (
    <div className="glass-card-lg pv2-score-card">
      <div className="pv2-score-top">
        <div>
          <div className="pv2-mini-label">Оценка кожи</div>
          <div className="pv2-score-value">
            {score}<span className="pv2-score-max">/100</span>
          </div>
        </div>
        <div
          className="pv2-score-ring"
          style={{ background: `conic-gradient(var(--accent-deep, #C2F03C) ${Math.max(0, Math.min(100, score))}%, rgba(10,10,10,0.08) 0)` }}
        >
          <span className="pv2-score-ring-label">{label}</span>
        </div>
      </div>
      <div className="pv2-score-quote">{description}</div>
      <div className="pv2-score-hint">
        <div className="pv2-score-hint-text">Оценка обновляется после отметок ежедневного ухода.</div>
        {/* ФИКС #13: круглая стрелка рядом с "Оценка" теперь ведёт на /home. */}
        <button
          type="button"
          className="pv2-icon-circle"
          onClick={onHintClick}
          aria-label="На главную"
        >
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  );
}

function ProfileCarousel({ cards }: { cards: ProfileCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="pv2-section pv2-profile-section">
      <div className="pv2-section-head">
        <div className="pv2-section-title">Профиль кожи</div>
        <div className="pv2-dots" aria-hidden>
          {cards.map((_, idx) => (
            <span key={idx} className={`pv2-dot ${idx === 0 ? 'pv2-dot-dash' : ''}`} />
          ))}
        </div>
      </div>
      <div className="pv2-profile-carousel">
        {cards.map((card, idx) => (
          <div className={`glass-card-md pv2-profile-card${idx === 0 ? ' pv2-profile-card-lime' : ''}`} key={card.key}>
            <div className="pv2-profile-label">{card.label}</div>
            <div className="pv2-profile-value">{card.value}</div>
            <div className="pv2-profile-desc">{card.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanPhasesProductsSection(props: {
  phases: PhaseUI[];
  products: ProductCard[];
  busyId: number | null;
  bulkAdding: boolean;
  onReplace: (p: ProductCard) => void;
  onToggleWishlist: (p: ProductCard) => void;
  onToggleCart: (p: ProductCard) => void;
  onAddAllToCart: (products: ProductCard[]) => void;
}) {
  const {
    phases,
    products,
    busyId,
    bulkAdding,
    onReplace,
    onToggleWishlist,
    onToggleCart,
    onAddAllToCart,
  } = props;

  const currentPhase = phases.find((phase) => phase.state === 'current')?.phase
    ?? phases[0]?.phase
    ?? 'adaptation';
  // Мультиоткрытие: раскрытые фазы держим в Set, чтобы разворот одной фазы не
  // сворачивал остальные (раньше был одиночный аккордеон — открытие «Фазы 2»
  // само захлопывало «Фазу 1»).
  const [openPhases, setOpenPhases] = useState<Set<PlanPhases>>(() => new Set([currentPhase]));

  // Текущую фазу держим открытой по умолчанию, не трогая вручную раскрытые.
  useEffect(() => {
    setOpenPhases((prev) => (prev.has(currentPhase) ? prev : new Set(prev).add(currentPhase)));
  }, [currentPhase]);

  const productsByPhase = useMemo(() => createProductsByPhaseMap(products), [products]);
  const productsToAddCount = products.filter((product) => !product.state.inCart).length;
  const allProductsInCart = products.length > 0 && productsToAddCount === 0;

  if (phases.length === 0 && products.length === 0) return null;

  return (
    <div className="pv2-section pv2-phases-products-section">
      <div className="pv2-section-head pv2-section-head-align-start">
        <div>
          <div className="pv2-section-title">Фазы и средства</div>
          <div className="pv2-section-subtitle">Средства подключаются по фазам, чтобы не перегружать кожу</div>
        </div>
      </div>

      {products.length > 0 && (
        <>
          <button
            type="button"
            className={`pv2-add-all-cta ${allProductsInCart ? 'pv2-add-all-done' : ''}`}
            onClick={() => onAddAllToCart(products)}
            disabled={bulkAdding || allProductsInCart}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M5.5 8h13l-1.2 10.2a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8Z" />
              <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
              {!allProductsInCart && <path d="M12 11v5M9.5 13.5h5" />}
            </svg>
            {bulkAdding
              ? 'Добавляем...'
              : allProductsInCart
                ? 'Весь набор в корзине'
                : 'Добавить весь набор на 28 дней'}
          </button>
          <div className="pv2-add-all-note">
            Средства постепенно подключаются по фазам
          </div>
        </>
      )}

      <div className="pv2-phase-accordion-list">
        {phases.map((phase) => {
          const phaseProducts = productsByPhase.get(phase.phase) ?? [];
          const isOpen = openPhases.has(phase.phase);
          const isCurrent = phase.state === 'current';

          return (
            <div
              className={`pv2-phase-accordion ${isOpen ? 'pv2-phase-accordion-open' : ''} ${isCurrent ? 'pv2-phase-accordion-current' : ''}`}
              key={phase.phase}
            >
              <button
                type="button"
                className="pv2-phase-accordion-trigger"
                onClick={(e) => {
                  // При сворачивании фазы высота страницы уменьшается и скролл
                  // «улетает» вниз (браузер клэмпит позицию к новому концу
                  // документа). Фиксируем позицию кликнутой шапки в вьюпорте
                  // до/после ре-рендера.
                  const el = e.currentTarget;
                  const before = el.getBoundingClientRect().top;
                  setOpenPhases((prev) => {
                    const next = new Set(prev);
                    if (next.has(phase.phase)) next.delete(phase.phase);
                    else next.add(phase.phase);
                    return next;
                  });
                  requestAnimationFrame(() => {
                    const after = el.getBoundingClientRect().top;
                    if (after !== before) window.scrollBy(0, after - before);
                  });
                }}
                aria-expanded={isOpen}
              >
                <span className={`pv2-phase-rail is-${phase.state}`} aria-hidden />
                <span className="pv2-phase-accordion-copy">
                  <span className="pv2-phase-eyebrow">
                    <span className={`pv2-phase-state is-${phase.state}`}>
                      {phase.state === 'current' ? 'Сейчас' : phase.state === 'past' ? 'Пройдена' : 'Скоро'}
                    </span>
                    <span className="pv2-phase-label">Фаза {orderOfPhase(phase.phase)}</span>
                  </span>
                  <span className="pv2-phase-name">{phase.phaseLabel}</span>
                  <span className="pv2-phase-days">{phase.daysLabel}</span>
                </span>
                <span className="pv2-phase-chevron" aria-hidden>
                  <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </button>

              {isOpen && (
                <div className="pv2-phase-panel">
                  <div className="pv2-phase-text">{phase.description}</div>

                  {phaseProducts.length > 0 ? (
                    <div className="pv2-product-list">
                      {phaseProducts.map((product) => (
                        <ProductCardView
                          key={product.id}
                          product={product}
                          isBusy={busyId === product.id || bulkAdding}
                          onReplace={onReplace}
                          onToggleWishlist={onToggleWishlist}
                          onToggleCart={onToggleCart}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="pv2-phase-empty">Новых средств в этой фазе нет.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function createProductsByPhaseMap(products: ProductCard[]): Map<PlanPhases, ProductCard[]> {
  const result = new Map<PlanPhases, ProductCard[]>([
    ['adaptation', []],
    ['active', []],
    ['support', []],
  ]);

  for (const product of products) {
    const list = result.get(product.firstPhase) ?? [];
    list.push(product);
    result.set(product.firstPhase, list);
  }

  return result;
}

function orderOfPhase(phase: PlanPhases): number {
  switch (phase) {
    case 'adaptation': return 1;
    case 'active':     return 2;
    case 'support':    return 3;
  }
}

// ФИКС #15: когда у продукта нет imageUrl (БД), показываем иконку-заглушку
// по выведенному шагу ухода (тот же набор иконок, что и на главной /icons/clean/*_true.png).
// Эвристика по названию продукта — порядок важен (специфичные категории раньше).
function inferStepIcon(name: string | undefined | null): string {
  const n = (name || '').toLowerCase();
  if (/spf|sunscreen|санскрин|солнцезащит/.test(n)) return '/icons/clean/spf_true.png';
  if (/cleanser|cleansing|пенк|гел[ьяе]\s*для|умыван|foam|wash|очищ|очист/.test(n)) return '/icons/clean/cleanser_true.png';
  if (/balm|бальзам|для\s+губ|lip\b/.test(n)) return '/icons/clean/lipbalm_true.png';
  if (/oil|масл/.test(n)) return '/icons/oil_green.png';
  if (/mask|маск/.test(n)) return '/icons/mask_green.png';
  if (/retinol|ретинол|aha|bha|acid|кислот|пилинг|peel/.test(n)) return '/icons/clean/treatment_true.png';
  if (/serum|сыворотк|essence|эссенц/.test(n)) return '/icons/clean/serum_true.png';
  if (/toner|тоник|тонер|mist/.test(n)) return '/icons/clean/toner_true.png';
  if (/effaclar\s+mat|cream|крем|moistur|емолл|moisturi|\bmat\b|baume|cicaplast|toleriane/.test(n)) return '/icons/clean/cream_true.png';
  return '/icons/clean/cleanser_true.png';
}

// Иконка-заглушка по продукту. Приоритет — у категории из БД (надёжнее, чем
// эвристика по названию: например, «Glycolic Acid 7% Toning Solution» — это
// категория `toner`, а по названию `acid` ошибочно ловился как treatment).
// Имя всё равно проверяем для нюансов, которые категория не различает
// (бальзам для губ и масло лежат в `moisturizer`).
const CATEGORY_ICON: Record<string, string> = {
  cleanser: '/icons/clean/cleanser_true.png',
  toner: '/icons/clean/toner_true.png',
  serum: '/icons/clean/serum_true.png',
  treatment: '/icons/clean/treatment_true.png',
  moisturizer: '/icons/clean/cream_true.png',
  cream: '/icons/clean/cream_true.png',
  eye_cream: '/icons/clean/cream_true.png',
  mask: '/icons/mask_green.png',
  spf: '/icons/clean/spf_true.png',
};
function resolveProductIcon(category: string | null | undefined, name: string | undefined | null): string {
  const n = (name || '').toLowerCase();
  // Нюансы, которые коробочная категория не различает.
  if (/balm|бальзам|для\s+губ|lip\b/.test(n)) return '/icons/clean/lipbalm_true.png';
  if (/oil|масл/.test(n)) return '/icons/oil_green.png';
  const byCategory = category ? CATEGORY_ICON[category.toLowerCase()] : undefined;
  if (byCategory) return byCategory;
  return inferStepIcon(name);
}

// Миниатюра продукта: показываем реальное фото, а если URL битый/не грузится —
// падаем на иконку-заглушку по шагу ухода (иначе у продукта вроде клинзера
// оставалась пустая белая плашка). Иконка лежит на лаймовом пятне (фон сзади).
function ProductThumb({ product }: { product: ProductCard }) {
  const [failed, setFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  // Сбрасываем флаг ошибки, если URL картинки сменился (например, после замены
  // продукта) — иначе однажды «упавшая» миниатюра навсегда залипала на иконке.
  useEffect(() => {
    setFailed(false);
    setIconFailed(false);
  }, [product.imageUrl, product.category, product.name]);
  const showIcon = !product.imageUrl || failed;
  return (
    <div className={`pv2-product-img ${showIcon ? 'pv2-product-img-icon' : ''}`}>
      {showIcon && iconFailed ? (
        <span className="pv2-product-img-fallback" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <path d="M23 17h18l2 8H21l2-8Z" />
            <path d="M18 25h28l3 27H15l3-27Z" />
            <path d="M22 35h20" />
          </svg>
        </span>
      ) : showIcon ? (
        <img
          className="pv2-product-img-icon-img"
          src={resolveProductIcon(product.category, product.name)}
          alt=""
          onError={() => setIconFailed(true)}
        />
      ) : (
        <img
          className="pv2-product-img-fill"
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

function ProductCardView(props: {
  product: ProductCard;
  isBusy: boolean;
  onReplace: (p: ProductCard) => void;
  onToggleWishlist: (p: ProductCard) => void;
  onToggleCart: (p: ProductCard) => void;
}) {
  const { product, isBusy, onReplace, onToggleWishlist, onToggleCart } = props;
  return (
    <div className="glass-card-sm pv2-product-card">
      <div className="pv2-product-main">
        <div className="pv2-product-media">
          <ProductThumb product={product} />
        </div>
        <div className="pv2-product-info">
          {product.brand && <div className="pv2-product-brand">{product.brand}</div>}
          <div className="pv2-product-name">{product.name}</div>
          {product.shortDescription && <div className="pv2-product-desc">{product.shortDescription}</div>}
          {product.phaseTags.length > 0 && (
            <div className="pv2-product-tags">
              {product.phaseTags.map((tag) => <span className="pv2-product-tag" key={tag}>{tag}</span>)}
            </div>
          )}
        </div>
      </div>
      {product.whyPicked && (
        <div className="pv2-product-why">
          <span className="pv2-product-why-label">Почему в вашем плане</span>
          {product.whyPicked}
        </div>
      )}
      <div className="pv2-product-actions">
        <button
          className={`pv2-icon-btn pv2-icon-heart ${product.state.inWishlist ? 'pv2-icon-active' : ''}`}
          onClick={() => onToggleWishlist(product)}
          disabled={isBusy}
          aria-label={product.state.inWishlist ? 'Убрать из избранного' : 'В избранное'}
        >
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button
          type="button"
          className="pv2-replace-btn"
          onClick={() => onReplace(product)}
          disabled={isBusy}
          title="Подобрать аналог"
          aria-label={`Подобрать аналог для ${product.name}`}
        >
          <RefreshCw aria-hidden="true" strokeWidth={2} />
          <span>Заменить</span>
        </button>
        <button
          type="button"
          className={`pv2-cart-cta ${product.state.inCart ? 'pv2-in-cart' : ''}`}
          onClick={() => onToggleCart(product)}
          disabled={isBusy}
        >
          <ShoppingCart aria-hidden="true" strokeWidth={2} />
          <span>{product.state.inCart ? 'В корзине' : 'В корзину'}</span>
        </button>
      </div>
    </div>
  );
}

function ExpertNotesCard({ notes, onRetakeQuiz }: { notes: ExpertNote[]; onRetakeQuiz: () => void }) {
  return (
    <div className="pv2-expert-card">
      <div className="pv2-expert-eyebrow">skiniq expert notes</div>
      <div className="pv2-expert-title">Советы дерматолога</div>
      <div className="pv2-expert-list">
        {notes.map((n) => (
          <div className="pv2-expert-item" key={n.number}>
            <div className="pv2-expert-num">{n.number}</div>
            <div className="pv2-expert-item-title">{n.title}</div>
            <div className="pv2-expert-item-text">{n.text}</div>
          </div>
        ))}
        <button className="pv2-expert-item pv2-expert-action" onClick={onRetakeQuiz}>
          <div className="pv2-expert-action-body">
            <div className="pv2-expert-item-title">Что-то изменилось?</div>
            <div className="pv2-expert-item-text">Перепройдите анкету, чтобы обновить рекомендации под текущее состояние кожи, новые средства или изменения в образе жизни.</div>
          </div>
          <span className="pv2-expert-action-arrow" aria-hidden>
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </button>
      </div>
    </div>
  );
}

function FeedbackSection({ onSubmit, submitted }: { onSubmit: (positive: boolean) => void; submitted: boolean }) {
  if (submitted) {
    return (
      <div className="glass-card-lg pv2-section">
        <div className="pv2-section-head">
          <div className="pv2-section-title">Спасибо за отзыв!</div>
        </div>
        <div className="pv2-feedback-thanks">Ваш ответ учтён — он помогает нам улучшать рекомендации.</div>
      </div>
    );
  }
  return (
    <div className="glass-card-lg pv2-section">
      <div className="pv2-section-head">
        <div className="pv2-section-title">Помогите нам стать лучше</div>
      </div>
      <div className="pv2-feedback-grid">
        <button className="glass-card-sm pv2-feedback-card pv2-feedback-positive" onClick={() => onSubmit(true)}>
          <span className="pv2-feedback-icon">
            <svg viewBox="0 0 24 24"><path d="M7 22V10M2 22h5V10H2zM20 9h-6l1-5a2 2 0 0 0-2-2l-3 7v11h9.7a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 20 9z"/></svg>
          </span>
          <span className="pv2-feedback-label">Всё подошло</span>
        </button>
        <button className="glass-card-sm pv2-feedback-card" onClick={() => onSubmit(false)}>
          <span className="pv2-feedback-icon">
            <svg viewBox="0 0 24 24"><path d="M17 2v12M22 2h-5v12h5zM4 15h6l-1 5a2 2 0 0 0 2 2l3-7V4H4.3a2 2 0 0 0-2 1.7L1 12.7A2 2 0 0 0 3 15z"/></svg>
          </span>
          <span className="pv2-feedback-label">Не подошло</span>
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
function PlanV2Styles() {
  return (
    <style jsx global>{`
      .pv2-root {
        min-height: 100svh;
        padding: 0 20px var(--bottom-nav-clearance);
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--ink);
        position: relative;
        isolation: isolate;
      }
      /* Фон — на фиксированном псевдо-слое (viewport-anchored), чтобы Telegram
         iOS WebView не показывал чужую подложку при overscroll. */
      .pv2-root::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background: var(--canvas);
      }
      .pv2-root > * {
        position: relative;
        z-index: 1;
      }
      /* Подложка html/body такая же, чтобы overscroll не светил старым фоном. */
      html, body { background-color: var(--canvas); }

      .pv2-topbar {
        padding: 22px 4px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pv2-logo {
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 18px;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: lowercase;
      }

      .pv2-personal-heading {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 28px;
        line-height: 1.16;
        letter-spacing: -0.7px;
        margin: 8px 4px 22px;
      }
      .pv2-personal-heading::after {
        content: "";
        display: block;
        width: 56px;
        height: 5px;
        margin-top: 14px;
        border-radius: 3px;
        background: var(--accent);
      }

      .pv2-double-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      .pv2-mini-card {
        padding-bottom: 22px;
      }
      .pv2-mini-dark {
        background: rgba(10,10,10,0.92);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .pv2-mini-label { font-size: 12px; color: var(--ink-soft); margin-bottom: 6px; }
      .pv2-mini-value {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.3px;
        margin-bottom: 10px;
      }
      .pv2-mini-sub { font-size: 12px; color: var(--ink-soft); }
      .pv2-mini-dark .pv2-mini-label { color: rgba(255,255,255,0.5); }
      .pv2-mini-dark .pv2-mini-value { color: var(--accent); }
      .pv2-mini-dark .pv2-mini-sub { color: rgba(255,255,255,0.5); }

      .pv2-score-card {
        margin-bottom: 14px;
      }
      .pv2-score-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
      }
      .pv2-score-value {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 48px;
        line-height: 1;
        letter-spacing: -1.5px;
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .pv2-score-max {
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 16px;
        font-weight: 500;
        color: var(--ink-mute);
      }
      .pv2-score-ring {
        position: relative;
        width: 92px;
        height: 92px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .pv2-score-ring::before {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: 50%;
        background: #fff;
      }
      .pv2-score-ring-label {
        position: relative;
        z-index: 1;
        font-weight: 700;
        font-size: 13px;
        text-align: center;
        line-height: 1.1;
        color: var(--ink);
      }
      .pv2-score-quote {
        border-left: 3px solid var(--accent);
        padding: 4px 0 4px 14px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--ink-soft);
        margin-bottom: 18px;
      }
      .pv2-score-hint {
        background: rgba(10,10,10,0.92);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .pv2-score-hint-text { font-size: 13px; color: rgba(255,255,255,0.78); line-height: 1.5; }
      .pv2-score-hint .pv2-icon-circle {
        background: rgba(var(--accent-rgb),0.16);
        border-color: rgba(var(--accent-rgb),0.34);
      }
      .pv2-score-hint .pv2-icon-circle svg { stroke: var(--accent); }

      .pv2-icon-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #fff;
        border: 1px solid var(--glass-border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
        padding: 0;
        appearance: none;
        -webkit-appearance: none;
        color: inherit;
        transition: transform .14s ease, background .14s ease;
      }
      .pv2-icon-circle:active { transform: scale(0.95); background: rgba(255,255,255,0.92); }
      .pv2-icon-circle svg {
        width: 16px;
        height: 16px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .pv2-section {
        margin-bottom: 14px;
      }
      .pv2-phases-products-section {
        padding: 6px 0 2px;
        background: transparent;
        border: none;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      .pv2-phases-products-section .pv2-section-head {
        padding: 0 4px;
      }
      /* Профиль кожи — без стеклянной «подложки» под каруселью: карточки лежат
         прямо на фоне страницы, без серого frosted-бокса позади скролл-контейнера.
         Padding сохраняем как у glass-card-lg (22px), чтобы заголовок секции
         оставался на одной линии с остальными секциями. */
      .pv2-profile-section {
        padding: 22px;
        background: transparent;
        border: none;
        box-shadow: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      .pv2-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
      }
      .pv2-section-head-align-start { align-items: flex-start; }
      .pv2-section-title {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: -0.3px;
      }
      .pv2-section-subtitle {
        font-size: 13px;
        color: var(--ink-soft);
        margin-top: 2px;
        line-height: 1.45;
      }
      .pv2-section-sub {
        font-size: 13px;
        color: var(--ink-soft);
        line-height: 1.5;
        margin: -4px 0 14px;
      }
      .pv2-add-all-cta {
        width: 100%;
        min-height: 48px;
        margin: 0 0 14px;
        border: 0;
        border-radius: 999px;
        background: var(--accent);
        color: var(--ink);
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(var(--accent-rgb),0.28);
        transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease;
      }
      .pv2-add-all-cta svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }
      .pv2-add-all-cta:active:not(:disabled) {
        transform: scale(0.985);
        box-shadow: 0 5px 12px rgba(var(--accent-rgb),0.22);
      }
      .pv2-add-all-cta:disabled {
        cursor: not-allowed;
        opacity: 0.72;
      }
      .pv2-add-all-cta.pv2-add-all-done {
        background: var(--ink);
        color: var(--accent);
        box-shadow: none;
      }

      .pv2-dots { display: flex; align-items: center; gap: 6px; }
      .pv2-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #D0D0D0;
      }
      .pv2-dot-dash {
        width: 22px;
        height: 6px;
        border-radius: 3px;
        background: var(--ink);
      }

      .pv2-profile-carousel {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        overflow-y: visible;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
        margin: 0 -22px;
        /* Сдвигаем первую карточку внутрь — раньше она прилипала к левому краю
           glass-card-контейнера (padding 22px ровно компенсировался отрицательным
           margin-left). Добавили 12px дополнительного отступа слева. */
        padding: 4px 22px 6px 34px;
        scroll-padding-inline-start: 34px;
      }
      .pv2-profile-carousel::-webkit-scrollbar { display: none; }
      /* Карточки профиля кожи показывают аккуратный peek следующего элемента.
         Доминирует одна карточка, следующая "подглядывает" — лучше читаемость
         label/value/desc и более «полные» карточки на экране. */
      .pv2-profile-card {
        flex: 0 0 calc(85% - 16px);
        scroll-snap-align: start;
        min-height: 210px;
      }
      /* Первая карточка — лаймовая акцентная (как в мокапе) */
      .pv2-profile-carousel .pv2-profile-card-lime {
        background: var(--accent);
        border-color: rgba(var(--accent-rgb), 0.85);
      }
      .pv2-profile-card-lime .pv2-profile-label { color: rgba(10,10,10,0.55); }
      .pv2-profile-card-lime .pv2-profile-desc { color: rgba(10,10,10,0.72); }
      .pv2-profile-label { font-size: 12px; color: var(--ink-soft); margin-bottom: 6px; }
      .pv2-profile-value {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: -0.2px;
        margin-bottom: 14px;
        line-height: 1.25;
      }
      .pv2-profile-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.55; }

      .pv2-add-all-note {
        margin: -4px 0 16px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(10,10,10,0.06);
        border: 1px solid rgba(10,10,10,0.07);
        color: var(--ink-soft);
        font-size: 12px;
        line-height: 1.45;
      }

      .pv2-phase-accordion-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .pv2-phase-accordion {
        border-radius: 24px;
        background: #fff;
        border: 1px solid var(--glass-border);
        box-shadow:
          0 8px 24px rgba(10,10,10,0.05),
          inset 0 1px 0 rgba(255,255,255,0.66);
        overflow: hidden;
      }
      .pv2-phase-accordion-current {
        background: #fff;
        border-color: rgba(var(--accent-rgb),0.72);
        box-shadow:
          0 10px 24px rgba(var(--accent-rgb),0.13),
          inset 0 1px 0 rgba(255,255,255,0.68);
      }
      .pv2-phase-accordion-current .pv2-phase-accordion-trigger {
        background: #fff;
      }
      .pv2-phase-accordion-trigger {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--ink);
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 12px;
        padding: 18px;
        cursor: pointer;
        text-align: left;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
      }
      /* Левый цветной рельс: лайм = текущая, чёрный = пройдена, серый = скоро */
      .pv2-phase-rail {
        width: 8px;
        height: 42px;
        border-radius: 999px;
        background: rgba(10,10,10,0.1);
      }
      .pv2-phase-rail.is-current { background: var(--accent-deep, #C2F03C); }
      .pv2-phase-rail.is-past { background: var(--ink); }
      .pv2-phase-accordion-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .pv2-phase-eyebrow {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
      }
      .pv2-phase-state {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 999px;
      }
      .pv2-phase-state.is-current { background: var(--accent); color: var(--ink); }
      .pv2-phase-state.is-past { background: rgba(10,10,10,0.08); color: var(--ink-soft); }
      .pv2-phase-state.is-upcoming { background: rgba(10,10,10,0.05); color: var(--ink-mute); }
      .pv2-phase-chevron {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .16s ease, background .16s ease;
      }
      .pv2-phase-chevron svg {
        width: 17px;
        height: 17px;
        fill: none;
        stroke: var(--ink);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .pv2-phase-accordion-open .pv2-phase-chevron {
        transform: rotate(180deg);
        background: #fff;
      }
      .pv2-phase-panel {
        padding: 0 14px 16px;
      }
      .pv2-phase-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 0;
      }
      .pv2-phase-name {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 17px;
        letter-spacing: -0.3px;
        margin-bottom: 4px;
      }
      .pv2-phase-days { font-size: 13px; color: var(--ink-soft); }
      .pv2-phase-text { font-size: 13px; color: #475467; line-height: 1.5; margin-bottom: 14px; }
      .pv2-phase-panel .pv2-product-list {
        margin-top: 12px;
      }
      .pv2-phase-panel .pv2-product-card {
        background: #fff;
        border-color: var(--glass-border);
        box-shadow: 0 8px 24px rgba(10,10,10,0.07);
      }
      .pv2-phase-empty {
        margin-top: 12px;
        padding: 14px 16px;
        border-radius: 18px;
        background: #fff;
        color: var(--ink-soft);
        font-size: 13px;
        line-height: 1.45;
      }

      .pv2-product-list { display: flex; flex-direction: column; gap: 12px; }
      .pv2-product-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .pv2-product-main {
        display: flex;
        gap: 14px;
        min-width: 0;
      }
      .pv2-product-media {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      .pv2-replace-btn {
        width: 100%;
        height: 40px;
        border-radius: 999px;
        background: #fff;
        border: 1px solid var(--glass-border);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        padding: 0 12px;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        font-weight: 800;
        color: var(--ink);
        min-width: 0;
        transition: transform .14s ease, background .14s ease;
      }
      .pv2-replace-btn span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pv2-replace-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .pv2-replace-btn:active:not(:disabled) { transform: scale(0.96); }
      .pv2-replace-btn svg {
        width: 15px;
        height: 15px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }
      .pv2-product-img {
        position: relative;
        width: 92px;
        height: 92px;
        border-radius: 16px;
        background: #fff;
        border: 1px solid var(--glass-border);
        flex-shrink: 0;
        overflow: hidden;
      }
      .pv2-product-img-fill {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Когда нет реального фото — показываем иконку на мягком лаймовом пятне,
         без серой квадратной подложки и ровного контура. */
      .pv2-product-img-icon {
        background: transparent;
        border-color: transparent;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        overflow: visible;
      }
      .pv2-product-img-icon::before {
        content: "";
        position: absolute;
        inset: 3px 2px 0;
        border-radius: 46% 54% 50% 50%;
        background: radial-gradient(circle at 50% 52%, rgba(var(--accent-rgb),0.88) 0%, rgba(var(--accent-rgb),0.58) 42%, rgba(var(--accent-rgb),0.18) 62%, transparent 78%);
        filter: blur(7px);
        transform: scale(1.04);
        z-index: 0;
        pointer-events: none;
      }
      /* Иконка лежит ПОВЕРХ лаймового пятна (без multiply — иначе белые части
         иконки «пробивались» лаймом и фон выглядел необрезанным). */
      .pv2-product-img-icon-img {
        position: relative;
        z-index: 1;
        display: block;
        width: 78%;
        height: 78%;
        margin: 11% auto 0;
        object-fit: contain;
        filter:
          drop-shadow(0 5px 12px rgba(10,10,10,0.24))
          drop-shadow(0 0 1px rgba(10,10,10,0.24));
      }
      .pv2-product-img-fallback {
        position: relative;
        z-index: 1;
        width: 78%;
        height: 78%;
        margin: 11% auto 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .pv2-product-img-fallback svg {
        width: 42%;
        height: 42%;
        fill: none;
        stroke: var(--ink);
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .pv2-product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .pv2-product-brand {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--ink-soft);
        margin-bottom: 2px;
      }
      .pv2-product-name {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: -0.2px;
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .pv2-product-desc { font-size: 13px; color: var(--ink-soft); margin-bottom: 8px; }
      .pv2-product-why {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.45;
        background: rgba(var(--accent-rgb), 0.10);
        border-left: 2px solid rgba(var(--accent-rgb), 0.9);
        border-radius: 0 8px 8px 0;
        padding: 7px 10px;
        margin-bottom: 8px;
      }
      .pv2-product-why-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--ink);
        opacity: 0.55;
        margin-bottom: 2px;
      }
      .pv2-product-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .pv2-product-tag {
        background: var(--ink);
        border: 1px solid var(--ink);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        color: #FFFFFF;
      }
      .pv2-product-actions {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        margin-top: 0;
      }
      .pv2-icon-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #fff;
        border: 1px solid var(--glass-border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        transition: transform .14s ease, background .14s ease;
      }
      .pv2-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .pv2-icon-btn:active { transform: scale(0.92); }
      .pv2-icon-btn svg {
        width: 16px;
        height: 16px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .pv2-icon-heart.pv2-icon-active {
        background: var(--accent);
        border-color: var(--accent);
        box-shadow: 0 6px 14px rgba(var(--accent-rgb),0.45);
      }
      .pv2-icon-heart.pv2-icon-active svg { fill: var(--ink); stroke: var(--ink); }
      .pv2-cart-cta {
        grid-column: 1 / -1;
        background: var(--ink);
        color: #fff;
        border: none;
        border-radius: 999px;
        width: 100%;
        height: 40px;
        padding: 0 16px;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        min-width: 0;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }
      .pv2-cart-cta svg { width: 16px; height: 16px; flex-shrink: 0; }
      .pv2-cart-cta:disabled { opacity: 0.6; cursor: not-allowed; }
      .pv2-cart-cta.pv2-in-cart { background: var(--accent); color: var(--ink); }

      .pv2-expert-card {
        background: rgba(10,10,10,0.86);
        backdrop-filter: var(--blur-lg);
        -webkit-backdrop-filter: var(--blur-lg);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 32px;
        padding: 24px;
        margin-bottom: 14px;
        color: #FFFFFF;
        position: relative;
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(0,0,0,0.15);
      }
      .pv2-expert-card::before {
        content: '';
        position: absolute;
        right: -40px;
        top: -40px;
        width: 160px;
        height: 160px;
        background: radial-gradient(circle, rgba(213,254,97,0.18) 0%, transparent 70%);
        pointer-events: none;
      }
      .pv2-expert-eyebrow {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        margin-bottom: 10px;
      }
      .pv2-expert-title {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 19px;
        letter-spacing: -0.3px;
        margin-bottom: 20px;
      }
      .pv2-expert-list { display: flex; flex-direction: column; gap: 10px; }
      .pv2-expert-item {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 22px;
        padding: 18px 20px;
        position: relative;
        text-align: left;
        color: #FFFFFF;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .pv2-expert-num {
        position: absolute;
        top: 18px;
        right: 22px;
        font-weight: 600;
        font-size: 13px;
        color: var(--accent);
      }
      .pv2-expert-item-title {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: -0.2px;
        line-height: 1.35;
        margin-bottom: 8px;
        padding-right: 32px;
      }
      .pv2-expert-item-text {
        font-size: 13px;
        color: rgba(255,255,255,0.65);
        line-height: 1.55;
      }
      .pv2-expert-action {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 18px 18px 20px;
        cursor: pointer;
      }
      .pv2-expert-action-body { flex: 1; min-width: 0; }
      .pv2-expert-action .pv2-expert-item-title { margin-bottom: 4px; padding-right: 0; }
      .pv2-expert-action-arrow {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255,255,255,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pv2-expert-action-arrow svg {
        width: 16px;
        height: 16px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .pv2-feedback-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .pv2-feedback-thanks {
        font-size: 14px;
        line-height: 1.45;
        color: var(--ink-soft);
      }
      .pv2-feedback-card {
        padding: 20px 18px;
        display: flex;
        flex-direction: column;
        gap: 32px;
        cursor: pointer;
        min-height: 120px;
        text-align: left;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .pv2-feedback-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.8);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv2-feedback-positive .pv2-feedback-icon { background: #E9F8B5; }
      .pv2-feedback-icon svg {
        width: 22px;
        height: 22px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .pv2-feedback-label {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: -0.2px;
      }
    `}</style>
  );
}
