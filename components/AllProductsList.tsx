// components/AllProductsList.tsx
// Компонент для отображения общего списка всех рекомендованных средств из плана

'use client';

import { useMemo } from 'react';
import type { Plan28 } from '@/lib/plan-types';
import { getStepDescription } from '@/lib/plan-types';

interface Product {
  id: number;
  name: string;
  brand: { name: string };
  price?: number;
  imageUrl?: string | null;
  description?: string;
}

interface AllProductsListProps {
  plan28: Plan28;
  products: Map<number, Product>;
  wishlistProductIds: Set<number>;
  cartQuantities: Map<number, number>;
  onToggleWishlist: (productId: number) => void;
  onAddToCart: (productId: number) => void;
}

// Маппинг категорий шагов на читаемые названия
const stepCategoryNames: Record<string, string> = {
  cleanser_gentle: 'Очищение (мягкое)',
  cleanser_balancing: 'Очищение (балансирующее)',
  cleanser_deep: 'Очищение (глубокое)',
  toner_hydrating: 'Тоник (увлажняющий)',
  toner_soothing: 'Тоник (успокаивающий)',
  serum_hydrating: 'Сыворотка (увлажняющая)',
  serum_niacinamide: 'Сыворотка (ниацинамид)',
  serum_vitc: 'Сыворотка (витамин C)',
  serum_anti_redness: 'Сыворотка (против покраснений)',
  serum_brightening_soft: 'Сыворотка (осветляющая)',
  treatment_acne_bpo: 'Лечение акне (бензоил пероксид)',
  treatment_acne_azelaic: 'Лечение акне (азелаиновая кислота)',
  treatment_acne_local: 'Лечение акне (точечное)',
  treatment_exfoliant_mild: 'Пилинг (мягкий)',
  treatment_exfoliant_strong: 'Пилинг (интенсивный)',
  treatment_pigmentation: 'Лечение пигментации',
  treatment_antiage: 'Антивозрастной уход',
  moisturizer_light: 'Крем (легкий)',
  moisturizer_balancing: 'Крем (балансирующий)',
  moisturizer_rich: 'Крем (насыщенный)',
  moisturizer_barrier: 'Крем (барьерный)',
  moisturizer_soothing: 'Крем (успокаивающий)',
  eye_cream_basic: 'Крем для глаз',
  eye_cream_dark_circles: 'Крем для глаз (от темных кругов)',
  eye_cream_puffiness: 'Крем для глаз (от отеков)',
  spf_50_face: 'SPF 50 (для лица)',
  spf_50_oily: 'SPF 50 (для жирной кожи)',
  spf_50_sensitive: 'SPF 50 (для чувствительной кожи)',
  mask_clay: 'Маска (глиняная)',
  mask_hydrating: 'Маска (увлажняющая)',
  mask_soothing: 'Маска (успокаивающая)',
  mask_sleeping: 'Маска (ночная)',
  spot_treatment: 'Точечное лечение',
  lip_care: 'Уход за губами',
  balm_barrier_repair: 'Бальзам (восстановление барьера)',
};

// Базовые категории для группировки
const baseCategoryMap: Record<string, string> = {
  cleanser: 'Очищение',
  toner: 'Тоник',
  serum: 'Сыворотка',
  treatment: 'Лечение',
  moisturizer: 'Увлажнение',
  eye_cream: 'Крем для глаз',
  spf: 'SPF защита',
  mask: 'Маски',
  spot_treatment: 'Точечное лечение',
  lip_care: 'Уход за губами',
  balm: 'Бальзам',
};

function getBaseCategory(stepCategory: string): string {
  for (const [base, name] of Object.entries(baseCategoryMap)) {
    if (stepCategory.startsWith(base)) {
      return name;
    }
  }
  return 'Другое';
}

export function AllProductsList({
  plan28,
  products,
  wishlistProductIds,
  cartQuantities,
  onToggleWishlist,
  onAddToCart,
}: AllProductsListProps) {
  // Собираем все уникальные продукты из плана
  const allProductsByCategory = useMemo(() => {
    const productsMap = new Map<string, Array<{ productId: string; stepCategory: string; dayIndex: number }>>();

    plan28.days.forEach((day) => {
      // Утренние шаги
      (day.morning || []).forEach((step) => {
        if (step.productId) {
          const category = getBaseCategory(step.stepCategory);
          if (!productsMap.has(category)) {
            productsMap.set(category, []);
          }
          const existing = productsMap.get(category)!;
          // Проверяем, не добавлен ли уже этот продукт в эту категорию
          if (!existing.some((p) => p.productId === step.productId && p.stepCategory === step.stepCategory)) {
            existing.push({
              productId: step.productId,
              stepCategory: step.stepCategory,
              dayIndex: day.dayIndex,
            });
          }
        }
      });

      // Вечерние шаги
      (day.evening || []).forEach((step) => {
        if (step.productId) {
          const category = getBaseCategory(step.stepCategory);
          if (!productsMap.has(category)) {
            productsMap.set(category, []);
          }
          const existing = productsMap.get(category)!;
          if (!existing.some((p) => p.productId === step.productId && p.stepCategory === step.stepCategory)) {
            existing.push({
              productId: step.productId,
              stepCategory: step.stepCategory,
              dayIndex: day.dayIndex,
            });
          }
        }
      });

      // Еженедельные шаги
      (day.weekly || []).forEach((step) => {
        if (step.productId) {
          const category = getBaseCategory(step.stepCategory);
          if (!productsMap.has(category)) {
            productsMap.set(category, []);
          }
          const existing = productsMap.get(category)!;
          if (!existing.some((p) => p.productId === step.productId && p.stepCategory === step.stepCategory)) {
            existing.push({
              productId: step.productId,
              stepCategory: step.stepCategory,
              dayIndex: day.dayIndex,
            });
          }
        }
      });
    });

    // Сортируем категории по порядку
    const categoryOrder = [
      'Очищение',
      'Тоник',
      'Сыворотка',
      'Лечение',
      'Увлажнение',
      'SPF защита',
      'Крем для глаз',
      'Маски',
      'Точечное лечение',
      'Уход за губами',
      'Бальзам',
      'Другое',
    ];

    const sorted = new Map<string, Array<{ productId: string; stepCategory: string; dayIndex: number }>>();
    categoryOrder.forEach((cat) => {
      if (productsMap.has(cat)) {
        sorted.set(cat, productsMap.get(cat)!);
      }
    });
    // Добавляем остальные категории
    productsMap.forEach((value, key) => {
      if (!sorted.has(key)) {
        sorted.set(key, value);
      }
    });

    return sorted;
  }, [plan28.days]);

  const totalProductsCount = useMemo(() => {
    let count = 0;
    allProductsByCategory.forEach((products) => {
      count += products.length;
    });
    return count;
  }, [allProductsByCategory]);

  if (totalProductsCount === 0) {
    return null;
  }

  return (
    <div style={{
      marginBottom: '32px',
      backgroundColor: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#0A5F59',
        marginBottom: '8px',
      }}>
        Все рекомендованные средства
      </h2>
      <p style={{
        fontSize: '14px',
        color: '#6B7280',
        marginBottom: '24px',
      }}>
        Полный список всех средств из вашего плана на 28 дней ({totalProductsCount} {totalProductsCount === 1 ? 'средство' : totalProductsCount < 5 ? 'средства' : 'средств'})
      </p>

      {Array.from(allProductsByCategory.entries()).map(([category, categoryProducts]) => (
        <div key={category} style={{ marginBottom: '32px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#0A5F59',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid #E8FBF7',
          }}>
            {category}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categoryProducts.map((item) => {
              const productId = parseInt(item.productId);
              const product = products.get(productId);
              if (!product) return null;

              const isInWishlist = wishlistProductIds.has(productId);
              const cartQuantity = cartQuantities.get(productId) || 0;
              const stepName = stepCategoryNames[item.stepCategory] || item.stepCategory;

              return (
                <div
                  key={`${productId}-${item.stepCategory}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  {/* Изображение продукта (если есть) */}
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {/* Информация о продукте */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {product.name}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '4px',
                    }}>
                      {product.brand.name}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      marginBottom: '8px',
                    }}>
                      {stepName}
                    </p>
                    {/* Теги продукта */}
                    {(() => {
                      const stepDesc = getStepDescription(item.stepCategory as any);
                      return stepDesc.tags.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {stepDesc.tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                backgroundColor: '#E8F5E9',
                                color: '#2E7D32',
                                fontWeight: '500',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {product.price && (
                      <p style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#0A5F59',
                      }}>
                        {product.price} ₽
                      </p>
                    )}
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    {/* Кнопка добавления в избранное */}
                    <button
                      onClick={() => onToggleWishlist(productId)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: `2px solid ${isInWishlist ? '#0A5F59' : '#D1D5DB'}`,
                        backgroundColor: isInWishlist ? '#0A5F59' : 'white',
                        color: isInWishlist ? 'white' : '#6B7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        transition: 'all 0.2s',
                      }}
                      title={isInWishlist ? 'Удалить из избранного' : 'Добавить в избранное'}
                    >
                      {isInWishlist ? '❤️' : '🤍'}
                    </button>

                    {/* Кнопка добавления в корзину */}
                    {cartQuantity > 0 ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#0A5F59',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                      }}>
                        <button
                          onClick={() => onAddToCart(productId)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          −
                        </button>
                        <span>{cartQuantity}</span>
                        <button
                          onClick={() => onAddToCart(productId)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onAddToCart(productId)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#0A5F59',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        В корзину
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

