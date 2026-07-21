// components/ReplaceProductModal.tsx
// Модалка замены продукта

'use client';

import { useState, useEffect } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ButtonSkeleton, InlineListSkeleton } from '@/components/ui/SkeletonLoader';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
}

interface AlternativeProduct {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
  whyBetter: string;
}

interface ReplaceProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (oldProductId: number, newProductId: number) => void;
}

export function ReplaceProductModal({ product, isOpen, onClose, onReplace }: ReplaceProductModalProps) {
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<number | null>(null);
  const productId = product?.id;

  useEffect(() => {
    if (!isOpen || !productId) return;

    let cancelled = false;

    const loadAlternatives = async () => {
      try {
        setSelectedAlternative(null);
        setLoading(true);
        const data = await api.getProductAlternatives(productId) as { alternatives: AlternativeProduct[] };
        if (!cancelled) {
          setAlternatives(data.alternatives || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error loading alternatives:', err);
          toast.error('Не удалось загрузить альтернативы');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAlternatives();

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId]);

  const handleReplace = async () => {
    if (!product || !selectedAlternative) return;

    try {
      setReplacing(true);
      await api.replaceProductInPlan(product.id, selectedAlternative);
      toast.success('Продукт заменен в плане');
      onReplace(product.id, selectedAlternative);
      onClose();
    } catch (err: any) {
      console.error('Error replacing product:', err);
      toast.error('Не удалось заменить продукт');
    } finally {
      setReplacing(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div
      className="replace-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="replace-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-product-title"
      >
        <div className="replace-modal-header">
          <div className="replace-modal-title-block">
            <h2 id="replace-product-title" className="replace-modal-title">
              Подобрать замену
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="replace-modal-close"
            aria-label="Закрыть"
          >
            <X aria-hidden="true" strokeWidth={2} />
          </button>
        </div>

        <div className="replace-current-card">
          <ProductThumb imageUrl={product.imageUrl} name={product.name} />
          <div className="replace-product-copy">
            <div className="replace-card-label">Сейчас в плане</div>
            <div className="replace-product-brand">{product.brand.name}</div>
            <div className="replace-product-name">{product.name}</div>
          </div>
        </div>

        <div className="replace-section-head">
          <div className="replace-section-title">Альтернативы</div>
          {alternatives.length > 0 && !loading && (
            <div className="replace-section-count">{alternatives.length}</div>
          )}
        </div>

        <div className="replace-modal-content">
          {loading ? (
            <div className="replace-loading">
              <InlineListSkeleton rows={3} dense />
            </div>
          ) : alternatives.length === 0 ? (
            <div className="replace-empty">
              <div className="replace-empty-icon" aria-hidden="true">
                <RefreshCw strokeWidth={1.9} />
              </div>
              <div className="replace-empty-title">Альтернативы не найдены</div>
              <div className="replace-empty-text">
                Пока оставим текущее средство в плане.
              </div>
            </div>
          ) : (
            <div className="replace-options">
              {alternatives.map((alt) => {
                const isSelected = selectedAlternative === alt.id;

                return (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => setSelectedAlternative(alt.id)}
                    className={`replace-option ${isSelected ? 'is-selected' : ''}`}
                    aria-pressed={isSelected}
                  >
                    <ProductThumb imageUrl={alt.imageUrl} name={alt.name} />
                    <div className="replace-option-copy">
                      <div className="replace-product-brand">{alt.brand.name}</div>
                      <div className="replace-product-name">{alt.name}</div>
                      <div className="replace-why">{alt.whyBetter}</div>
                    </div>
                    <span className="replace-select-mark" aria-hidden="true">
                      {isSelected && <Check strokeWidth={2.4} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="replace-modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="replace-action-secondary"
            disabled={replacing}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleReplace}
            disabled={!selectedAlternative || loading || replacing}
            className="replace-action-primary"
          >
            {replacing ? (
              <ButtonSkeleton light width="96px" />
            ) : (
              <>
                <RefreshCw aria-hidden="true" strokeWidth={2} />
                <span>Заменить в плане</span>
              </>
            )}
          </button>
        </div>

        {/* global, а не scoped: styled-jsx-скоуп не навешивает jsx-класс на
            элементы этого компонента (и на дочерний ProductThumb), поэтому
            обычный `<style jsx>` давал мёртвый CSS и модалка рендерилась
            неоформленной. Все селекторы префиксованы .replace-*, утечки нет. */}
        <style jsx global>{`
          .replace-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 12px;
            padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            background: rgba(10, 10, 10, 0.48);
            -webkit-backdrop-filter: blur(8px);
            backdrop-filter: blur(8px);
          }

          .replace-modal-sheet {
            width: 100%;
            max-width: 520px;
            max-height: calc(100svh - 24px - env(safe-area-inset-bottom, 0px));
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 28px;
            background: var(--canvas);
            border: 1px solid rgba(255, 255, 255, 0.72);
            box-shadow:
              0 22px 60px rgba(0, 0, 0, 0.24),
              0 1px 2px rgba(10, 10, 10, 0.08);
            color: var(--ink);
            font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
          }

          .replace-modal-header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 40px;
            gap: 14px;
            align-items: center;
            padding: 22px 20px 16px;
          }

          .replace-modal-title-block {
            min-width: 0;
          }

          .replace-card-label {
            color: var(--ink-soft);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0;
            text-transform: uppercase;
          }

          .replace-modal-title {
            margin: 0;
            color: var(--ink);
            font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.15;
            letter-spacing: 0;
          }

          .replace-modal-close {
            width: 40px;
            height: 40px;
            border: 1px solid var(--glass-border);
            border-radius: 50%;
            background: var(--canvas-white);
            color: var(--ink);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
            transition: transform 0.14s ease, background 0.14s ease;
          }

          .replace-modal-close:active {
            transform: scale(0.94);
            background: rgba(10, 10, 10, 0.04);
          }

          .replace-modal-close svg,
          .replace-action-primary svg,
          .replace-empty-icon svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
          }

          .replace-current-card {
            margin: 0 20px 18px;
            padding: 12px;
            display: grid;
            grid-template-columns: 66px minmax(0, 1fr);
            gap: 12px;
            align-items: center;
            border-radius: 22px;
            background: rgba(10, 10, 10, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--canvas-white);
          }

          .replace-current-card :global(.replace-thumb) {
            width: 66px;
            height: 66px;
            border-color: rgba(255, 255, 255, 0.12);
          }

          .replace-current-card .replace-card-label,
          .replace-current-card .replace-product-brand {
            color: rgba(255, 255, 255, 0.52);
          }

          .replace-current-card .replace-product-name {
            color: var(--canvas-white);
          }

          .replace-product-copy,
          .replace-option-copy {
            min-width: 0;
          }

          .replace-product-brand {
            margin: 4px 0 2px;
            color: var(--ink-soft);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.25;
            text-transform: uppercase;
          }

          .replace-product-name {
            color: var(--ink);
            font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0;
            line-height: 1.28;
          }

          .replace-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 0 20px 10px;
          }

          .replace-section-title {
            font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.2;
          }

          .replace-section-count {
            min-width: 26px;
            height: 26px;
            padding: 0 8px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--accent);
            color: var(--ink);
            font-size: 12px;
            font-weight: 800;
          }

          .replace-modal-content {
            min-height: 0;
            overflow-y: auto;
            padding: 0 20px 18px;
            -webkit-overflow-scrolling: touch;
          }

          .replace-loading {
            padding: 2px 0 6px;
          }

          .replace-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .replace-option {
            width: 100%;
            min-width: 0;
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr) 26px;
            gap: 12px;
            align-items: center;
            padding: 12px;
            border: 1px solid var(--glass-border);
            border-radius: 22px;
            background: var(--canvas-white);
            color: var(--ink);
            text-align: left;
            cursor: pointer;
            font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
            box-shadow: var(--glass-shadow);
            transition:
              transform 0.14s ease,
              border-color 0.14s ease,
              background 0.14s ease,
              box-shadow 0.14s ease;
          }

          .replace-option:active {
            transform: scale(0.985);
          }

          .replace-option.is-selected {
            border-color: rgba(var(--accent-rgb), 0.95);
            background: linear-gradient(0deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.18)), var(--canvas-white);
            box-shadow: 0 10px 24px rgba(var(--accent-rgb), 0.17);
          }

          .replace-why {
            margin-top: 8px;
            padding: 7px 10px;
            border-left: 2px solid rgba(var(--accent-rgb), 0.95);
            border-radius: 0 8px 8px 0;
            background: rgba(var(--accent-rgb), 0.12);
            color: var(--ink-soft);
            font-size: 12px;
            line-height: 1.42;
          }

          .replace-select-mark {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(10, 10, 10, 0.16);
            background: var(--canvas-white);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--ink);
          }

          .replace-option.is-selected .replace-select-mark {
            border-color: var(--accent);
            background: var(--accent);
            box-shadow: 0 6px 14px rgba(var(--accent-rgb), 0.38);
          }

          .replace-select-mark svg {
            width: 15px;
            height: 15px;
          }

          .replace-empty {
            min-height: 168px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 28px 18px;
            border: 1px solid var(--glass-border);
            border-radius: 22px;
            background: var(--canvas-white);
          }

          .replace-empty-icon {
            width: 42px;
            height: 42px;
            margin-bottom: 12px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--accent);
            color: var(--ink);
          }

          .replace-empty-title {
            color: var(--ink);
            font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.25;
          }

          .replace-empty-text {
            margin-top: 6px;
            color: var(--ink-soft);
            font-size: 13px;
            line-height: 1.45;
          }

          .replace-modal-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
            gap: 10px;
            padding: 14px 20px 20px;
            border-top: 1px solid rgba(10, 10, 10, 0.07);
            background: rgba(252, 252, 251, 0.96);
          }

          .replace-action-secondary,
          .replace-action-primary {
            min-width: 0;
            height: 48px;
            border-radius: 999px;
            padding: 0 16px;
            font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0;
            cursor: pointer;
            transition: transform 0.14s ease, opacity 0.14s ease, background 0.14s ease;
          }

          .replace-action-secondary {
            border: 1px solid rgba(10, 10, 10, 0.14);
            background: var(--canvas-white);
            color: var(--ink);
          }

          .replace-action-primary {
            border: 1px solid var(--ink);
            background: var(--ink);
            color: var(--canvas-white);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .replace-action-secondary:active:not(:disabled),
          .replace-action-primary:active:not(:disabled) {
            transform: scale(0.985);
          }

          .replace-action-secondary:disabled,
          .replace-action-primary:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }

          .replace-action-primary span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          @media (min-width: 640px) {
            .replace-modal-overlay {
              align-items: center;
              padding: 24px;
            }

            .replace-modal-sheet {
              max-height: min(760px, calc(100svh - 48px));
            }
          }

          @media (max-width: 359px) {
            .replace-modal-actions {
              grid-template-columns: 1fr;
            }

            .replace-option {
              grid-template-columns: 62px minmax(0, 1fr) 24px;
              gap: 10px;
            }
          }

          .replace-thumb {
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 18px;
            overflow: hidden;
            flex-shrink: 0;
            background: rgba(var(--accent-rgb), 0.24);
            border: 1px solid rgba(10, 10, 10, 0.08);
          }

          .replace-thumb-fill {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .replace-thumb-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(var(--accent-rgb), 0.36);
            overflow: visible;
          }

          .replace-thumb-icon-img {
            width: 78%;
            height: 78%;
            object-fit: contain;
            filter: drop-shadow(0 5px 10px rgba(10, 10, 10, 0.18));
          }

          .replace-thumb-fallback {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--ink);
          }

          .replace-thumb-fallback svg {
            width: 100%;
            height: 100%;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
        `}</style>
      </div>
    </div>
  );
}

function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setIconFailed(false);
  }, [imageUrl, name]);

  const showIcon = !imageUrl || imageFailed;

  return (
    <div className={`replace-thumb ${showIcon ? 'replace-thumb-icon' : ''}`}>
      {showIcon && iconFailed ? (
        <span className="replace-thumb-fallback" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <path d="M23 17h18l2 8H21l2-8Z" />
            <path d="M18 25h28l3 27H15l3-27Z" />
            <path d="M22 35h20" />
          </svg>
        </span>
      ) : showIcon ? (
        <img
          className="replace-thumb-icon-img"
          src={resolveProductIcon(name)}
          alt=""
          onError={() => setIconFailed(true)}
        />
      ) : (
        <img
          className="replace-thumb-fill"
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

function resolveProductIcon(name: string): string {
  const n = name.toLowerCase();
  if (/spf|sunscreen|санскрин|солнцезащит/.test(n)) return '/icons/clean/spf_true.png';
  if (/cleanser|cleansing|пенк|гел[ьяе]\s*для|умыван|foam|wash|очищ|очист/.test(n)) return '/icons/clean/cleanser_true.png';
  if (/balm|бальзам|для\s+губ|lip\b/.test(n)) return '/icons/clean/lipbalm_true.png';
  if (/oil|масл/.test(n)) return '/icons/oil_green.png';
  if (/mask|маск/.test(n)) return '/icons/mask_green.png';
  if (/retinol|ретинол|aha|bha|acid|кислот|пилинг|peel/.test(n)) return '/icons/clean/treatment_true.png';
  if (/serum|сыворотк|essence|эссенц/.test(n)) return '/icons/clean/serum_true.png';
  if (/toner|тоник|тонер|mist/.test(n)) return '/icons/clean/toner_true.png';
  if (/cream|крем|moistur|емолл|baume|cicaplast|toleriane/.test(n)) return '/icons/clean/cream_true.png';
  return '/icons/clean/serum_true.png';
}
