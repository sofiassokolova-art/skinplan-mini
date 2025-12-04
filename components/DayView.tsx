// components/DayView.tsx
// Компонент отображения одного дня плана

'use client';

import { StepCard } from './StepCard';
import type { DayPlan } from '@/lib/plan-types';
import { getPhaseLabel, getPhaseDescription } from '@/lib/plan-types';
import { AlertCircle } from 'lucide-react';

interface DayViewProps {
  dayPlan: DayPlan;
  mainGoals: string[];
  products: Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>;
  wishlistProductIds?: Set<number>;
  cartQuantities?: Map<number, number>; // Map productId -> quantity
  onToggleWishlist?: (productId: number) => void;
  onAddToCart?: (productId: number) => void;
  onReplace?: (stepCategory: string, productId: number) => void;
  completedMorning?: boolean;
  completedEvening?: boolean;
  onCompleteMorning?: () => void;
  onCompleteEvening?: () => void;
}

export function DayView({
  dayPlan,
  mainGoals,
  products,
  wishlistProductIds = new Set(),
  cartQuantities = new Map(),
  onToggleWishlist,
  onAddToCart,
  onReplace,
  completedMorning = false,
  completedEvening = false,
  onCompleteMorning,
  onCompleteEvening,
}: DayViewProps) {
  const phaseLabel = getPhaseLabel(dayPlan.phase);
  const phaseDescription = getPhaseDescription(dayPlan.phase, mainGoals);

  // Проверяем, есть ли активные шаги (кислоты, пилинги) в вечерней рутине
  const hasActiveEveningSteps = dayPlan.evening.some(step => 
    step.stepCategory.includes('exfoliant') || 
    step.stepCategory.includes('treatment') ||
    step.stepCategory.includes('acne')
  );

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(10, 95, 89, 0.1)',
    }}>
      {/* Заголовок дня */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          День {dayPlan.dayIndex} · {phaseLabel}
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          lineHeight: '1.6',
        }}>
          {phaseDescription}
        </p>
      </div>

      {/* Предупреждение об активных шагах */}
      {hasActiveEveningSteps && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FCD34D',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}>
          <AlertCircle size={20} color="#D97706" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400E', marginBottom: '4px' }}>
              Активный шаг сегодня вечером
            </div>
            <div style={{ fontSize: '12px', color: '#78350F' }}>
              Не используй другие пилинги и обязательно нанеси SPF утром.
            </div>
          </div>
        </div>
      )}

      {/* Блок "Утро" */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
          }}>
            Утро
          </h3>
          {onCompleteMorning && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#6B7280',
            }}>
              <input
                type="checkbox"
                checked={completedMorning}
                onChange={onCompleteMorning}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
              />
              Выполнено
            </label>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dayPlan.morning.map((step, index) => {
            // Защита от undefined products
            if (!products) {
              console.error('DayView: products Map is undefined');
              return null;
            }
            
            // Пробуем найти продукт по productId (может быть строка или число)
            let product = null;
            if (step.productId) {
              const productIdNum = Number(step.productId);
              product = products.get(productIdNum);
              
              // Если не нашли по числу, пробуем по строке
              if (!product && !isNaN(productIdNum)) {
                product = products.get(productIdNum);
              }
              
              // Логируем, если продукт не найден
              if (!product) {
                console.error('❌ DayView: Product not found for step', {
                  stepCategory: step.stepCategory,
                  productId: step.productId,
                  productIdNum,
                  productsMapSize: products.size,
                  productIdsInMap: Array.from(products.keys()).slice(0, 10),
                  dayIndex: dayPlan.dayIndex,
                });
              }
            }
            
            // Если продукт не найден, пробуем альтернативы
            if (!product && step.alternatives.length > 0) {
              for (const altId of step.alternatives) {
                const altIdNum = Number(altId);
                const altProduct = products.get(altIdNum);
                if (altProduct) {
                  product = altProduct;
                  console.log('Found product in alternatives:', altIdNum);
                  break;
                }
              }
            }
            
            return (
              <StepCard
                key={`${step.stepCategory}-${index}`}
                step={step}
                product={product || undefined}
                isInWishlist={product ? wishlistProductIds.has(product.id) : false}
                cartQuantity={product ? (cartQuantities.get(product.id) || 0) : 0}
                onToggleWishlist={onToggleWishlist}
                onAddToCart={onAddToCart}
                onReplace={onReplace && product ? (s, pId) => onReplace(s.stepCategory, pId) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Блок "Вечер" */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
          }}>
            Вечер
          </h3>
          {onCompleteEvening && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#6B7280',
            }}>
              <input
                type="checkbox"
                checked={completedEvening}
                onChange={onCompleteEvening}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
              />
              Выполнено
            </label>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dayPlan.evening.map((step, index) => {
            // Защита от undefined products
            if (!products) {
              console.error('DayView: products Map is undefined');
              return null;
            }
            
            // Пробуем найти продукт по productId (может быть строка или число)
            let product = null;
            if (step.productId) {
              const productIdNum = Number(step.productId);
              product = products.get(productIdNum);
              
              // Логируем, если продукт не найден
              if (!product) {
                console.warn('Product not found for evening step:', {
                  stepCategory: step.stepCategory,
                  productId: step.productId,
                  productIdNum,
                  productsMapSize: products.size,
                });
              }
            }
            
            // Если продукт не найден, пробуем альтернативы
            if (!product && step.alternatives.length > 0) {
              for (const altId of step.alternatives) {
                const altIdNum = Number(altId);
                const altProduct = products.get(altIdNum);
                if (altProduct) {
                  product = altProduct;
                  console.log('Found product in alternatives:', altIdNum);
                  break;
                }
              }
            }
            
            return (
              <StepCard
                key={`${step.stepCategory}-${index}`}
                step={step}
                product={product || undefined}
                isInWishlist={product ? wishlistProductIds.has(product.id) : false}
                cartQuantity={product ? (cartQuantities.get(product.id) || 0) : 0}
                onToggleWishlist={onToggleWishlist}
                onAddToCart={onAddToCart}
                onReplace={onReplace && product ? (s, pId) => onReplace(s.stepCategory, pId) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Блок "1-2 раза в неделю" (если есть) */}
      {dayPlan.isWeeklyFocusDay && dayPlan.weekly.length > 0 && (
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <span style={{ fontSize: '16px' }}>🗓</span>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#111827',
            }}>
              Дополнительный уход сегодня
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dayPlan.weekly.map((step, index) => {
              // Защита от undefined products
              if (!products) {
                console.error('DayView: products Map is undefined');
                return null;
              }
              
              let product = step.productId ? products.get(Number(step.productId)) : null;
              
              // Если продукт не найден, пробуем альтернативы
              if (!product && step.alternatives.length > 0) {
                for (const altId of step.alternatives) {
                  const altProduct = products.get(Number(altId));
                  if (altProduct) {
                    product = altProduct;
                    break;
                  }
                }
              }
              
              return (
                <div key={`weekly-${step.stepCategory}-${index}`}>
                  <div style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    marginBottom: '8px',
                  }}>
                    Раз в неделю · только вечером
                  </div>
                  <StepCard
                    step={step}
                    product={product || undefined}
                    isInWishlist={product ? wishlistProductIds.has(product.id) : false}
                    cartQuantity={product ? (cartQuantities.get(product.id) || 0) : 0}
                    onToggleWishlist={onToggleWishlist}
                    onAddToCart={onAddToCart}
                    onReplace={onReplace && product ? (s, pId) => onReplace(s.stepCategory, pId) : undefined}
                  />
                </div>
              );
            })}
          </div>

          <div style={{
            fontSize: '12px',
            color: '#9CA3AF',
            marginTop: '12px',
            fontStyle: 'italic',
          }}>
            Если кожа чувствительная или в раздражении — этот шаг можно пропустить.
          </div>
        </div>
      )}
    </div>
  );
}

