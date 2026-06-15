// app/(miniapp)/plan/plan-page-v2.tsx
// Новый компонент страницы плана: self-fetching, читает /api/plan/page-context
// и рендерит всё на основе PlanPageContext.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { invalidatePlanWarmCache } from '@/lib/plan-warm-cache';
import toast from 'react-hot-toast';
import { PaymentGate } from '@/components/PaymentGate';
import { resolvePlanPaywall, hasWinbackOfferParam } from '@/lib/paywall-product';
import type {
  PlanPageContext,
  ProductCard,
  PhaseUI,
  ProfileCard,
  ExpertNote,
} from '@/lib/plan-page/types';

interface ProductActionState {
  /** productId, по которому сейчас идёт запрос (чтобы блокировать повторные нажатия) */
  busyId: number | null;
}

export function PlanPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [context, setContext] = useState<PlanPageContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ProductActionState>({ busyId: null });
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

  const loadContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPlanPageContext();
      if (res.state === 'no_plan' || !res.context) {
        router.replace('/quiz');
        return;
      }
      setContext(res.context);
    } catch (err: any) {
      clientLogger.error('Failed to load plan page context', err);
      setError('Не удалось загрузить план. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
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
      await loadContext();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось обновить избранное');
    } finally {
      setActionState({ busyId: null });
    }
  }, [actionState.busyId, loadContext]);

  const handleToggleCart = useCallback(async (product: ProductCard) => {
    if (actionState.busyId === product.id) return;
    setActionState({ busyId: product.id });
    try {
      if (product.state.inCart) {
        await api.removeFromCart(product.id);
        toast.success('Убрано из корзины');
      } else {
        await api.addToCart(product.id);
        toast.success('В корзине');
      }
      await loadContext();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось обновить корзину');
    } finally {
      setActionState({ busyId: null });
    }
  }, [actionState.busyId, loadContext]);

  const handleReplaceClick = useCallback((product: ProductCard) => {
    // Открываем подбор аналогов в существующем UI-flow.
    // Маршрут /products/alternatives/:id используется в проекте.
    router.push(`/products/alternatives/${product.id}`);
  }, [router]);

  const handleFeedback = useCallback(async (isPositive: boolean) => {
    try {
      await api.submitFeedback(isPositive, isPositive ? [] : ['plan_does_not_fit']);
      toast.success(isPositive ? 'Спасибо за фидбек!' : 'Передадим в команду');
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось отправить фидбек');
    }
  }, []);

  if (loading) {
    return <PlanV2Skeleton />;
  }

  if (error || !context) {
    return (
      <div className="pv2-error app-bottom-nav-clearance">
        <p>{error ?? 'План не найден'}</p>
        <button className="btn-primary" onClick={loadContext}>Обновить</button>
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
        <div className="pv2-logo">SkinIQ</div>
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
        retakeCta={{ text: 'Изменились цели? Перепройти анкету', href: '/quiz?retake=1' }}
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
            <div className="pv2-mini-label">SkinIQ streak</div>
            <div className="pv2-mini-value">{context.streak.label}</div>
            <div className="pv2-mini-sub">Отмечен ежедневный уход</div>
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

        {/* 6. Phases */}
        <PhasesSection phases={context.phases} />

        {/* 7. Products */}
        <ProductsSection
          products={context.products}
          busyId={actionState.busyId}
          onReplace={handleReplaceClick}
          onToggleWishlist={handleToggleWishlist}
          onToggleCart={handleToggleCart}
        />

        {/* 8. Expert notes */}
        <ExpertNotesCard
          notes={context.expertNotes}
          onRetakeQuiz={() => {
            invalidatePlanWarmCache();
            router.push('/quiz?retake=1');
          }}
        />

        {/* 9. Feedback */}
        <FeedbackSection onSubmit={handleFeedback} />

        <div style={{ height: 100 }} />
      </PaymentGate>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

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
        <div className="pv2-score-badge">{label}</div>
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
        {cards.map((card) => (
          <div className="glass-card-md pv2-profile-card" key={card.key}>
            <div className="pv2-profile-label">{card.label}</div>
            <div className="pv2-profile-value">{card.value}</div>
            <div className="pv2-profile-desc">{card.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasesSection({ phases }: { phases: PhaseUI[] }) {
  return (
    <div className="glass-card-lg pv2-section">
      <div className="pv2-section-head pv2-section-head-align-start">
        <div>
          <div className="pv2-section-title">3 фазы плана</div>
          <div className="pv2-section-subtitle">Постепенное подключение ухода без перегрузки кожи</div>
        </div>
        <div className="pv2-phases-badge">28<br/>дней</div>
      </div>
      <div className="pv2-timeline">
        {phases.map((p) => (
          <div className={`pv2-timeline-item ${p.state === 'current' ? 'pv2-current' : ''}`} key={p.phase}>
            <div className="pv2-timeline-marker" />
            <div className={`glass-card-md pv2-phase-card ${p.state === 'current' ? 'pv2-phase-current' : ''}`}>
              <div className="pv2-phase-arrow" aria-hidden>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </div>
              <div className="pv2-phase-label">Фаза {orderOfPhase(p)}</div>
              <div className="pv2-phase-name">{p.phaseLabel}</div>
              <div className="pv2-phase-days">{p.daysLabel}</div>
              <div className="pv2-phase-text">{p.description}</div>
              {p.tags.length > 0 && (
                <div className="pv2-phase-tags">
                  {p.tags.map((t) => <span className="pv2-phase-tag" key={t}>{t}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function orderOfPhase(p: PhaseUI): number {
  switch (p.phase) {
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
  if (/cream|крем|moistur|емолл|moisturi/.test(n)) return '/icons/clean/cream_true.png';
  return '/icons/clean/cleanser_true.png';
}

// Миниатюра продукта: показываем реальное фото, а если URL битый/не грузится —
// падаем на иконку-заглушку по шагу ухода (иначе у продукта вроде клинзера
// оставалась пустая белая плашка). Иконка лежит на лаймовом пятне (фон сзади).
function ProductThumb({ product }: { product: ProductCard }) {
  const [failed, setFailed] = useState(false);
  // Сбрасываем флаг ошибки, если URL картинки сменился (например, после замены
  // продукта) — иначе однажды «упавшая» миниатюра навсегда залипала на иконке.
  useEffect(() => { setFailed(false); }, [product.imageUrl]);
  const showIcon = !product.imageUrl || failed;
  return (
    <div className={`pv2-product-img ${showIcon ? 'pv2-product-img-icon' : ''}`}>
      {showIcon ? (
        <img
          className="pv2-product-img-icon-img"
          src={inferStepIcon(product.name)}
          alt=""
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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

function ProductsSection(props: {
  products: ProductCard[];
  busyId: number | null;
  onReplace: (p: ProductCard) => void;
  onToggleWishlist: (p: ProductCard) => void;
  onToggleCart: (p: ProductCard) => void;
}) {
  const { products, busyId, onReplace, onToggleWishlist, onToggleCart } = props;
  if (products.length === 0) return null;

  return (
    <div className="glass-card-lg pv2-section">
      <div className="pv2-section-head">
        <div className="pv2-section-title">Средства плана</div>
      </div>
      <div className="pv2-product-list">
        {products.map((p) => {
          const isBusy = busyId === p.id;
          return (
            <div className="glass-card-sm pv2-product-card" key={p.id}>
              {/* Левая колонка: иконка/фото + под ней действия (лайк, заменить) */}
              <div className="pv2-product-media">
                <ProductThumb product={p} />
                <div className="pv2-product-icon-actions">
                  <button
                    className={`pv2-icon-btn pv2-icon-heart ${p.state.inWishlist ? 'pv2-icon-active' : ''}`}
                    onClick={() => onToggleWishlist(p)}
                    disabled={isBusy}
                    aria-label={p.state.inWishlist ? 'Убрать из избранного' : 'В избранное'}
                  >
                    <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                  <button
                    className="pv2-icon-btn"
                    onClick={() => onReplace(p)}
                    disabled={isBusy || p.replacementsCount === 0}
                    aria-label="Заменить"
                    title={p.replacementsCount > 0 ? `Заменить (${p.replacementsCount} аналогов)` : 'Нет аналогов'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v6h-6M3 20v-6h6"/></svg>
                  </button>
                </div>
              </div>
              <div className="pv2-product-info">
                <div className="pv2-product-name">{p.name}</div>
                {p.shortDescription && <div className="pv2-product-desc">{p.shortDescription}</div>}
                {p.phaseTags.length > 0 && (
                  <div className="pv2-product-tags">
                    {p.phaseTags.map((t) => <span className="pv2-product-tag" key={t}>{t}</span>)}
                  </div>
                )}
                <div className="pv2-product-actions">
                  <button
                    className={`pv2-cart-cta ${p.state.inCart ? 'pv2-in-cart' : ''}`}
                    onClick={() => onToggleCart(p)}
                    disabled={isBusy}
                  >
                    {p.state.inCart ? 'В корзине' : 'В корзину'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpertNotesCard({ notes, onRetakeQuiz }: { notes: ExpertNote[]; onRetakeQuiz: () => void }) {
  return (
    <div className="pv2-expert-card">
      <div className="pv2-expert-eyebrow">SkinIQ expert notes</div>
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

function FeedbackSection({ onSubmit }: { onSubmit: (positive: boolean) => void }) {
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

// ─── Skeleton ────────────────────────────────────────────────────
// Повторяет реальную сетку страницы: heading + 2 mini-card + score +
// карусель профиля + фазы + продукты + expert-notes + feedback.
// Включён общий shimmer-эффект, чтобы пользователь сразу видел структуру.
function PlanV2Skeleton() {
  return (
    <div className="pv2-root pv2-skeleton-root">
      <PlanV2Styles />
      <PlanV2SkeletonStyles />

      {/* Topbar */}
      <div className="pv2-topbar">
        <div className="pv2-skel-bar" style={{ width: 72, height: 16 }} />
      </div>

      {/* Personal heading */}
      <div style={{ margin: '8px 4px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="pv2-skel-bar" style={{ width: '80%', height: 22 }} />
        <div className="pv2-skel-bar" style={{ width: '55%', height: 22 }} />
      </div>

      {/* Two mini cards */}
      <div className="pv2-double-row">
        <div className="glass-card-md pv2-mini-card pv2-skel-block" style={{ height: 110 }}>
          <div className="pv2-skel-bar" style={{ width: 80, height: 10, marginBottom: 8 }} />
          <div className="pv2-skel-bar" style={{ width: '60%', height: 18, marginBottom: 12 }} />
          <div className="pv2-skel-bar" style={{ width: '40%', height: 10 }} />
        </div>
        <div className="glass-card-md pv2-mini-card pv2-mini-dark pv2-skel-block" style={{ height: 110 }}>
          <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: 80, height: 10, marginBottom: 8 }} />
          <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: '70%', height: 18, marginBottom: 12 }} />
          <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: '50%', height: 10 }} />
        </div>
      </div>

      {/* Score */}
      <div className="glass-card-lg pv2-score-card pv2-skel-block">
        <div className="pv2-score-top">
          <div style={{ flex: 1 }}>
            <div className="pv2-skel-bar" style={{ width: 80, height: 10, marginBottom: 10 }} />
            <div className="pv2-skel-bar" style={{ width: 120, height: 42 }} />
          </div>
          <div className="pv2-skel-circle" style={{ width: 92, height: 92 }} />
        </div>
        <div style={{ paddingLeft: 14, borderLeft: '3px solid #E5E5E5', marginBottom: 18 }}>
          <div className="pv2-skel-bar" style={{ width: '95%', height: 12, marginBottom: 6 }} />
          <div className="pv2-skel-bar" style={{ width: '85%', height: 12, marginBottom: 6 }} />
          <div className="pv2-skel-bar" style={{ width: '70%', height: 12 }} />
        </div>
        <div className="pv2-skel-bar" style={{ width: '100%', height: 44, borderRadius: 18 }} />
      </div>

      {/* Profile carousel */}
      <div className="pv2-section pv2-profile-section pv2-skel-block">
        <div className="pv2-section-head">
          <div className="pv2-skel-bar" style={{ width: 120, height: 18 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="pv2-skel-bar" style={{ width: 22, height: 6, borderRadius: 3 }} />
            <div className="pv2-skel-bar" style={{ width: 6, height: 6, borderRadius: 999 }} />
            <div className="pv2-skel-bar" style={{ width: 6, height: 6, borderRadius: 999 }} />
            <div className="pv2-skel-bar" style={{ width: 6, height: 6, borderRadius: 999 }} />
          </div>
        </div>
        <div className="pv2-profile-carousel">
          {[0, 1, 2].map((idx) => (
            <div className="glass-card-md pv2-profile-card" key={idx}>
              <div className="pv2-skel-bar" style={{ width: 60, height: 10, marginBottom: 6 }} />
              <div className="pv2-skel-bar" style={{ width: '70%', height: 16, marginBottom: 14 }} />
              <div className="pv2-skel-bar" style={{ width: '100%', height: 10, marginBottom: 5 }} />
              <div className="pv2-skel-bar" style={{ width: '90%', height: 10, marginBottom: 5 }} />
              <div className="pv2-skel-bar" style={{ width: '60%', height: 10 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Phases */}
      <div className="glass-card-lg pv2-section pv2-skel-block">
        <div className="pv2-section-head pv2-section-head-align-start">
          <div style={{ flex: 1 }}>
            <div className="pv2-skel-bar" style={{ width: 100, height: 18, marginBottom: 6 }} />
            <div className="pv2-skel-bar" style={{ width: '70%', height: 11 }} />
          </div>
          <div className="pv2-skel-bar" style={{ width: 56, height: 36, borderRadius: 999 }} />
        </div>
        <div className="pv2-timeline">
          {[0, 1, 2].map((idx) => (
            <div className="pv2-timeline-item" key={idx}>
              <div className="pv2-timeline-marker" />
              <div className="glass-card-md pv2-phase-card">
                <div className="pv2-skel-bar" style={{ width: 50, height: 10, marginBottom: 8 }} />
                <div className="pv2-skel-bar" style={{ width: 120, height: 16, marginBottom: 6 }} />
                <div className="pv2-skel-bar" style={{ width: 70, height: 11, marginBottom: 14 }} />
                <div className="pv2-skel-bar" style={{ width: '100%', height: 11, marginBottom: 5 }} />
                <div className="pv2-skel-bar" style={{ width: '85%', height: 11 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="glass-card-lg pv2-section pv2-skel-block">
        <div className="pv2-section-head">
          <div className="pv2-skel-bar" style={{ width: 140, height: 18 }} />
        </div>
        <div className="pv2-product-list">
          {[0, 1].map((idx) => (
            <div className="glass-card-sm pv2-product-card" key={idx}>
              <div className="pv2-skel-bar" style={{ width: 92, height: 92, borderRadius: 16, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pv2-skel-bar" style={{ width: '70%', height: 14, marginBottom: 4 }} />
                <div className="pv2-skel-bar" style={{ width: '90%', height: 12, marginBottom: 10 }} />
                <div className="pv2-skel-bar" style={{ width: 80, height: 20, borderRadius: 999, marginBottom: 10 }} />
                <div className="pv2-skel-bar" style={{ width: 60, height: 14, marginBottom: 14 }} />
                <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.5)' }}>
                  <div className="pv2-skel-bar" style={{ width: 36, height: 36, borderRadius: 999 }} />
                  <div className="pv2-skel-bar" style={{ width: 36, height: 36, borderRadius: 999 }} />
                  <div style={{ flex: 1 }} />
                  <div className="pv2-skel-bar" style={{ width: 124, height: 36, borderRadius: 999 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expert notes (dark) */}
      <div className="pv2-expert-card pv2-skel-block">
        <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: 130, height: 10, marginBottom: 10 }} />
        <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: 200, height: 20, marginBottom: 20 }} />
        {[0, 1].map((idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 22,
            padding: '18px 20px',
            marginBottom: 10,
          }}>
            <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: '70%', height: 14, marginBottom: 10 }} />
            <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: '100%', height: 12, marginBottom: 6 }} />
            <div className="pv2-skel-bar pv2-skel-bar-on-dark" style={{ width: '80%', height: 12 }} />
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="glass-card-lg pv2-section pv2-skel-block">
        <div className="pv2-section-head">
          <div className="pv2-skel-bar" style={{ width: 200, height: 18 }} />
        </div>
        <div className="pv2-feedback-grid">
          <div className="glass-card-sm pv2-feedback-card pv2-skel-block">
            <div className="pv2-skel-circle" style={{ width: 44, height: 44 }} />
            <div className="pv2-skel-bar" style={{ width: 100, height: 14 }} />
          </div>
          <div className="glass-card-sm pv2-feedback-card pv2-skel-block">
            <div className="pv2-skel-circle" style={{ width: 44, height: 44 }} />
            <div className="pv2-skel-bar" style={{ width: 90, height: 14 }} />
          </div>
        </div>
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}

function PlanV2SkeletonStyles() {
  return (
    <style jsx global>{`
      @keyframes pv2-skel-shimmer {
        0%   { background-position: -300px 0; }
        100% { background-position: 300px 0; }
      }
      .pv2-skel-bar,
      .pv2-skel-circle {
        background: linear-gradient(
          90deg,
          rgba(0,0,0,0.04) 0%,
          rgba(0,0,0,0.10) 50%,
          rgba(0,0,0,0.04) 100%
        );
        background-size: 300px 100%;
        animation: pv2-skel-shimmer 1.4s linear infinite;
        border-radius: 6px;
      }
      .pv2-skel-bar-on-dark {
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.12) 50%,
          rgba(255,255,255,0.04) 100%
        );
        background-size: 300px 100%;
      }
      .pv2-skel-circle {
        border-radius: 50%;
      }
      .pv2-skel-block {
        /* Подавляем тяжёлые hover/interaction-эффекты под скелетоном */
        pointer-events: none;
      }
      .pv2-skeleton-root .pv2-mini-dark .pv2-skel-bar {
        /* Внутри тёмной мини-карточки бары — светлые */
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.04) 0%,
          rgba(255,255,255,0.12) 50%,
          rgba(255,255,255,0.04) 100%
        );
        background-size: 300px 100%;
      }
    `}</style>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
function PlanV2Styles() {
  return (
    <style jsx global>{`
      /* Повторяем мягкие цветовые пятна главной: карточки остаются читаемыми,
         а план визуально продолжает тот же экранный стиль приложения. */
      .pv2-root {
        min-height: 100svh;
        padding: 0 20px var(--bottom-nav-clearance);
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--ink);
        position: relative;
      }
      /* Фон — на фиксированном псевдо-слое (viewport-anchored). Раньше использовался
         background-attachment:fixed, но он не закрашивает весь документ в Telegram
         iOS WebView → при листании появлялся белый/пустой фон. Фиксированный
         ::before гарантированно покрывает экран на всю высоту. */
      .pv2-root::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background:
          radial-gradient(72% 32% at 0% 0%, rgba(255,224,188,0.7) 0%, transparent 62%),
          radial-gradient(50% 22% at 100% 18%, rgba(213,254,97,0.42) 0%, transparent 70%),
          radial-gradient(64% 26% at 100% 55%, rgba(220,210,196,0.55) 0%, transparent 65%),
          radial-gradient(78% 32% at 10% 92%, rgba(213,254,97,0.46) 0%, transparent 62%),
          var(--canvas);
      }
      /* Зеркало #19: подложка html/body тоже беж, чтобы overscroll не светил белым. */
      html, body { background-color: var(--canvas); }

      .pv2-topbar {
        padding: 22px 4px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pv2-logo {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.4px;
      }

      .pv2-personal-heading {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 26px;
        line-height: 1.2;
        letter-spacing: -0.6px;
        margin: 8px 4px 22px;
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
        background: rgba(10,10,10,0.88);
        backdrop-filter: blur(24px) saturate(140%);
        -webkit-backdrop-filter: blur(24px) saturate(140%);
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
      .pv2-score-badge {
        width: 92px;
        height: 92px;
        border-radius: 50%;
        border: 6px solid var(--accent);
        background: rgba(255,255,255,0.7);
        backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
        flex-shrink: 0;
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
        background: rgba(10,10,10,0.88);
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
        background: rgba(255,255,255,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.8);
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

      .pv2-phases-badge {
        background: rgba(10,10,10,0.88);
        backdrop-filter: blur(12px);
        color: #FFFFFF;
        font-weight: 600;
        font-size: 12px;
        padding: 8px 14px;
        border-radius: 999px;
        text-align: center;
        line-height: 1.15;
      }

      .pv2-timeline { position: relative; padding-left: 32px; }
      .pv2-timeline::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 14px;
        bottom: 14px;
        width: 1.5px;
        background: #E5E5E5;
      }
      .pv2-timeline-item { position: relative; padding-bottom: 10px; }
      .pv2-timeline-item:last-child { padding-bottom: 0; }
      .pv2-timeline-marker {
        position: absolute;
        left: -32px;
        top: 22px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #FFFFFF;
        border: 1.5px solid #D0D0D0;
      }
      .pv2-timeline-item.pv2-current .pv2-timeline-marker {
        background: var(--accent);
        border-color: var(--accent);
        box-shadow: 0 0 0 4px rgba(213,254,97,0.25);
      }
      .pv2-phase-card {
        padding: 18px 20px;
        position: relative;
      }
      .pv2-phase-current {
        background: linear-gradient(135deg, rgba(213,254,97,0.7) 0%, rgba(213,254,97,0.45) 100%);
        border-color: rgba(213,254,97,0.55);
      }
      .pv2-phase-arrow {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255,255,255,0.75);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pv2-phase-arrow svg {
        width: 14px;
        height: 14px;
        stroke: var(--ink);
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .pv2-phase-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--ink-soft);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .pv2-phase-name {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-size: 17px;
        letter-spacing: -0.3px;
        margin-bottom: 4px;
      }
      .pv2-phase-days { font-size: 13px; color: var(--ink-soft); margin-bottom: 14px; }
      .pv2-phase-text { font-size: 13px; color: #475467; line-height: 1.5; margin-bottom: 14px; }
      .pv2-phase-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .pv2-phase-tag {
        background: rgba(255,255,255,0.6);
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 999px;
        padding: 5px 12px;
        font-size: 12px;
        color: #475467;
      }

      .pv2-product-list { display: flex; flex-direction: column; gap: 12px; }
      .pv2-product-card {
        padding: 16px;
        display: flex;
        gap: 14px;
      }
      /* Левая колонка: фото/иконка, а под ней кнопки лайк + заменить */
      .pv2-product-media {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .pv2-product-icon-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      .pv2-product-img {
        position: relative;
        width: 92px;
        height: 92px;
        border-radius: 16px;
        background: rgba(255,255,255,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.8);
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
      /* Когда нет реального фото — рисуем неоновое лаймовое пятно за иконкой.
         Это даёт визуальную опору для PNG-иконок (маска/крем/etc), у которых
         бывает белый или прозрачный фон — без glow иконка «висит в воздухе». */
      .pv2-product-img-icon {
        background: radial-gradient(60% 60% at 50% 55%, rgba(var(--accent-rgb),0.85) 0%, rgba(var(--accent-rgb),0.45) 45%, rgba(255,255,255,0.5) 75%, rgba(255,255,255,0.7) 100%);
      }
      .pv2-product-img-icon::before {
        content: "";
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(var(--accent-rgb),0.55) 0%, transparent 60%);
        filter: blur(8px);
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
        filter: drop-shadow(0 4px 10px rgba(10,10,10,0.18));
      }
      .pv2-product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .pv2-product-name {
        font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: -0.2px;
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .pv2-product-desc { font-size: 13px; color: var(--ink-soft); margin-bottom: 8px; }
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
        display: flex;
        align-items: center;
        justify-content: flex-end;
        margin-top: auto;
        padding-top: 14px;
      }
      .pv2-icon-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.8);
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
        background: var(--accent);
        color: var(--ink);
        border: none;
        border-radius: 999px;
        padding: 10px 22px;
        font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        min-width: 124px;
      }
      .pv2-cart-cta:disabled { opacity: 0.6; cursor: not-allowed; }
      .pv2-cart-cta.pv2-in-cart { background: var(--ink); color: var(--accent); }

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
