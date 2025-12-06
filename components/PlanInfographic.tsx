// components/PlanInfographic.tsx
// Инфографика для плана: что нужно коже, как работаем, за счет каких средств

'use client';

import { Heart, ShoppingCart, RefreshCw } from 'lucide-react';
import type { Plan28 } from '@/lib/plan-types';
import { getStepDescription } from '@/lib/plan-types';
import { getBaseStepFromStepCategory } from '@/lib/plan-helpers';

interface PlanInfographicProps {
  plan28: Plan28;
  products: Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>;
  wishlistProductIds?: Set<number>;
  cartQuantities?: Map<number, number>;
  onToggleWishlist?: (productId: number) => void;
  onAddToCart?: (productId: number) => void;
  onReplace?: (product: { id: number; name: string; brand: { name: string } }) => void;
}

export function PlanInfographic({ 
  plan28, 
  products,
  wishlistProductIds = new Set<number>(),
  cartQuantities = new Map<number, number>(),
  onToggleWishlist,
  onAddToCart,
  onReplace,
}: PlanInfographicProps) {
  // Собираем категории с продуктами и их описаниями
  interface CategoryData {
    name: string;
    description: string;
    products: Array<{
      id: number;
      name: string;
      brand: string;
      stepCategory: string; // Добавляем stepCategory для получения тегов
    }>;
  }
  
  // Маппинг базовых категорий на русские названия
  const baseCategoryMap: Record<string, string> = {
    cleanser: 'Очищение',
    toner: 'Тоник',
    serum: 'Сыворотка',
    treatment: 'Лечение',
    moisturizer: 'Увлажнение',
    eye_cream: 'Крем для глаз',
    spf: 'SPF защита',
    mask: 'Маска',
    lip_care: 'Уход за губами',
  };

  const categoryMap = new Map<string, CategoryData>();
  
  plan28.days.forEach(day => {
    [...day.morning, ...day.evening, ...day.weekly].forEach(step => {
      if (step.productId) {
        const product = products.get(Number(step.productId));
        if (product) {
          // Определяем базовую категорию
          const baseStep = getBaseStepFromStepCategory(step.stepCategory);
          const categoryName = baseCategoryMap[baseStep] || baseStep;
          
          // Получаем описание для первого шага этой категории
          const stepDesc = getStepDescription(step.stepCategory);
          
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
              name: categoryName,
              description: stepDesc.subtitle,
              products: [],
            });
          }
          
          const categoryData = categoryMap.get(categoryName)!;
          // Добавляем продукт, если его еще нет
          const productKey = `${product.brand.name} ${product.name}`;
          if (!categoryData.products.some(p => p.id === product.id)) {
            categoryData.products.push({
              id: product.id,
              name: product.name,
              brand: product.brand.name,
              stepCategory: step.stepCategory, // Сохраняем stepCategory для получения тегов
            });
          }
        }
      }
    });
  });
  
  const categories = Array.from(categoryMap.values());

  const goalLabels: Record<string, string> = {
    acne: 'Акне и высыпания',
    pores: 'Сокращение пор',
    pigmentation: 'Выравнивание пигментации',
    barrier: 'Укрепление барьера',
    dehydration: 'Увлажнение',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      marginBottom: '32px',
    }}>
      {/* За счет каких средств */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>💧</span>
          За счет каких средств мы достигнем цели
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {categories.map((category) => (
            <div
              key={category.name}
              style={{
                padding: '20px',
                backgroundColor: '#F5FFFC',
                borderRadius: '12px',
                border: '1px solid rgba(10, 95, 89, 0.2)',
              }}
            >
              {/* Название категории и описание */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#0A5F59',
                    marginBottom: '4px',
                  }}>
                    {category.name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    lineHeight: '1.5',
                  }}>
                    {category.description}
                  </div>
                </div>
              </div>
              
              {/* Продукты в этой категории */}
              {category.products.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(10, 95, 89, 0.1)',
                }}>
                  {category.products.map((product, idx) => {
                    const productId = product.id;
                    const isInWishlist = wishlistProductIds.has(productId);
                    const cartQuantity = cartQuantities.get(productId) || 0;
                    const fullProduct = products.get(productId);
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          marginBottom: idx < category.products.length - 1 ? '12px' : '0',
                          border: '1px solid rgba(10, 95, 89, 0.1)',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#374151',
                              marginBottom: '4px',
                            }}>
                              {product.name}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6B7280',
                            }}>
                              {product.brand}
                            </div>
                            {fullProduct?.price && (
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#0A5F59',
                                marginTop: '4px',
                              }}>
                                {fullProduct.price} ₽
                              </div>
                            )}
                            {/* Теги продукта */}
                            {(() => {
                              const stepDesc = getStepDescription(product.stepCategory as any);
                              return stepDesc.tags.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
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
                          </div>
                        </div>
                        
                        {/* Кнопки действий */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          {onToggleWishlist && (
                            <button
                              onClick={() => onToggleWishlist(productId)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '12px',
                                backgroundColor: isInWishlist ? '#FEE2E2' : '#F3F4F6',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                color: isInWishlist ? '#DC2626' : '#6B7280',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isInWishlist ? '#FECACA' : '#E5E7EB';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isInWishlist ? '#FEE2E2' : '#F3F4F6';
                              }}
                            >
                              <Heart size={16} fill={isInWishlist ? '#DC2626' : 'none'} />
                              {isInWishlist ? 'В избранном' : 'В избранное'}
                            </button>
                          )}

                          {onAddToCart && (
                            <button
                              onClick={() => onAddToCart(productId)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '12px',
                                backgroundColor: cartQuantity > 0 ? '#10B981' : '#0A5F59',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = cartQuantity > 0 ? '#059669' : '#065F46';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = cartQuantity > 0 ? '#10B981' : '#0A5F59';
                              }}
                            >
                              <ShoppingCart size={16} />
                              {cartQuantity > 0 ? `В корзине (${cartQuantity})` : 'В корзину'}
                            </button>
                          )}

                          {onReplace && fullProduct && (
                            <button
                              onClick={() => onReplace(fullProduct)}
                              style={{
                                padding: '10px',
                                borderRadius: '12px',
                                backgroundColor: '#F3F4F6',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                color: '#6B7280',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#E5E7EB';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#F3F4F6';
                              }}
                            >
                              <RefreshCw size={16} />
                              Заменить
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#E8FBF7',
          borderRadius: '12px',
          border: '1px dashed #0A5F59',
        }}>
          <div style={{
            fontSize: '14px',
            color: '#065F46',
            lineHeight: '1.6',
            fontStyle: 'italic',
          }}>
            💡 Все средства подобраны индивидуально на основе вашего типа кожи и целей. 
            Каждый продукт работает в синергии с другими для максимальной эффективности.
          </div>
        </div>
      </div>

      {/* Как мы будем работать */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>🔬</span>
          Как мы будем работать
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#FEF3C7',
            borderRadius: '12px',
            border: '1px solid #FCD34D',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#92400E',
              marginBottom: '8px',
            }}>
              Фаза 1: Адаптация (дни 1-7)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.6',
            }}>
              Мягкое внедрение ухода. Постепенно знакомим кожу с новыми средствами, минимизируя раздражение.
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#DBEAFE',
            borderRadius: '12px',
            border: '1px solid #60A5FA',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E40AF',
              marginBottom: '8px',
            }}>
              Фаза 2: Активная работа (дни 8-21)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1E3A8A',
              lineHeight: '1.6',
            }}>
              Подключаем активные ингредиенты для решения ваших задач. Интенсивная работа над улучшением состояния кожи.
            </div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#D1FAE5',
            borderRadius: '12px',
            border: '1px solid #34D399',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#065F46',
              marginBottom: '8px',
            }}>
              Фаза 3: Поддержка (дни 22-28)
            </div>
            <div style={{
              fontSize: '14px',
              color: '#064E3B',
              lineHeight: '1.6',
            }}>
              Закрепляем достигнутые результаты и поддерживаем здоровье барьера кожи.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

