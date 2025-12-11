// components/CareRoutine.tsx
// Пошаговый уход с продуктами (утро/вечер)

'use client';

import { useState } from 'react';
import type { CareStep } from '@/lib/api-types';

interface CareRoutineProps {
  morningSteps: CareStep[];
  eveningSteps: CareStep[];
  onAddToRoutine: (productId: number) => void;
  inRoutineProducts: Set<number>;
  onToggleWishlist?: (productId: number) => void;
  wishlistProductIds?: Set<number>;
}

export function CareRoutine({
  morningSteps,
  eveningSteps,
  onAddToRoutine,
  inRoutineProducts,
  onToggleWishlist,
  wishlistProductIds = new Set(),
}: CareRoutineProps) {
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
  const currentSteps = activeTab === 'morning' ? morningSteps : eveningSteps;

  return (
    <div style={{
      marginBottom: '32px',
    }}>
      <h2 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '24px',
        color: '#0A5F59',
        marginBottom: '20px',
      }}>
        Ваши рекомендации
      </h2>

      {/* Табы Утро/Вечер */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        backgroundColor: 'rgba(10, 95, 89, 0.08)',
        borderRadius: '16px',
        padding: '4px',
      }}>
        <button
          onClick={() => setActiveTab('morning')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: activeTab === 'morning' ? '#0A5F59' : 'transparent',
            color: activeTab === 'morning' ? 'white' : '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: activeTab === 'morning' ? 700 : 500,
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Утро
        </button>
        <button
          onClick={() => setActiveTab('evening')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: activeTab === 'evening' ? '#0A5F59' : 'transparent',
            color: activeTab === 'evening' ? 'white' : '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: activeTab === 'evening' ? 700 : 500,
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Вечер
        </button>
      </div>

      {/* Шаги ухода */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {currentSteps.map((step) => (
          <div
            key={step.stepNumber}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.58)',
              backdropFilter: 'blur(26px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Заголовок шага */}
            <div style={{
              marginBottom: '12px',
            }}>
              <h3 style={{
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '18px',
                color: '#0A5F59',
                marginBottom: '6px',
              }}>
                Шаг {step.stepNumber}: {step.stepName}
              </h3>
              <p style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '14px',
                color: '#475467',
                lineHeight: '1.5',
                marginBottom: '8px',
              }}>
                {step.stepDescription}
              </p>
              {/* Теги шага */}
              {step.stepTags.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {step.stepTags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontSize: '11px',
                        color: '#0A5F59',
                        backgroundColor: 'rgba(10, 95, 89, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        fontWeight: 500,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Продукты */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {step.products.map((product) => {
                const isInRoutine = inRoutineProducts.has(product.id);
                const isInWishlist = wishlistProductIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '12px',
                      border: '1px solid rgba(10, 95, 89, 0.1)',
                    }}
                  >
                    {/* Изображение продукта */}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(10, 95, 89, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg
                          viewBox="0 0 24 24"
                          width="32"
                          height="32"
                          fill="none"
                          stroke="#0A5F59"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 9h6v6H9z" />
                        </svg>
                      </div>
                    )}

                    {/* Информация о продукте */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                    }}>
                      <h4 style={{
                        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#0A5F59',
                        marginBottom: '4px',
                      }}>
                        {product.name}
                      </h4>
                      <p style={{
                        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontSize: '12px',
                        color: '#475467',
                        marginBottom: '4px',
                      }}>
                        {product.brand.name}
                      </p>
                      {product.price && (
                        <p style={{
                          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#0A5F59',
                          marginBottom: '4px',
                        }}>
                          {product.price.toLocaleString('ru-RU')} ₽
                        </p>
                      )}
                      {/* Теги продукта */}
                      {product.tags && product.tags.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          marginTop: '4px',
                        }}>
                          {product.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              style={{
                                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                                fontSize: '10px',
                                color: '#0A5F59',
                                backgroundColor: 'rgba(10, 95, 89, 0.08)',
                                padding: '2px 6px',
                                borderRadius: '6px',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Кнопки действий */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      alignItems: 'flex-end',
                    }}>
                      <button
                        onClick={() => onAddToRoutine(product.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '12px',
                          border: isInRoutine ? '1px solid #0A5F59' : 'none',
                          backgroundColor: isInRoutine ? 'white' : '#0A5F59',
                          color: isInRoutine ? '#0A5F59' : 'white',
                          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isInRoutine ? 'В уходе' : 'Добавить в уход'}
                      </button>
                      {onToggleWishlist && (
                        <button
                          onClick={() => onToggleWishlist(product.id)}
                          style={{
                            padding: '4px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill={isInWishlist ? '#0A5F59' : 'none'}
                            stroke={isInWishlist ? '#0A5F59' : '#94A3B8'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
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
    </div>
  );
}

