// components/quiz/content/TestimonialsCarousel.tsx
// Компонент для отображения отзывов с горизонтальным скроллом
// ОБНОВЛЕНО: Новый дизайн с лаймовыми звездами и картинками до/после

import React from 'react';
import type { Testimonial } from '@/app/(miniapp)/quiz/info-screens';

export interface TestimonialsCarouselProps {
  testimonials: Testimonial[];
}

// Компонент лаймовой звезды
function LimeStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M10 1L12.39 6.26L18 7.27L14 11.14L14.76 17L10 14.27L5.24 17L6 11.14L2 7.27L7.61 6.26L10 1Z" 
        fill="#D5FE61" 
        stroke="#D5FE61" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '16px', 
      overflowX: 'auto',
      padding: '8px 0',
      marginBottom: '28px',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      msOverflowStyle: 'none',
      marginLeft: '-20px',
      marginRight: '-20px',
      paddingLeft: '20px',
      paddingRight: '40px', // Больше отступа справа чтобы было видно обрезку
    }}>
      {testimonials.map((testimonial, idx: number) => (
        <div key={idx} style={{
          minWidth: '300px',
          maxWidth: '300px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Картинки до/после */}
          {(testimonial.beforeImage || testimonial.afterImage) && (
            <div style={{
              display: 'flex',
              width: '100%',
              height: '120px',
              overflow: 'hidden',
            }}>
              {testimonial.beforeImage && (
                <div style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <img 
                    src={testimonial.beforeImage}
                    alt="До"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}>
                    До
                  </div>
                </div>
              )}
              {testimonial.afterImage && (
                <div style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <img 
                    src={testimonial.afterImage}
                    alt="После"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: '#D5FE61',
                    color: '#000000',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}>
                    После
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Контент отзыва */}
          <div style={{ 
            padding: '16px 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}>
            {/* Лаймовые звезды */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '12px',
            }}>
              {Array.from({ length: testimonial.stars || 5 }).map((_, i) => (
                <LimeStar key={i} />
              ))}
            </div>

            {/* Текст отзыва */}
            <p style={{ 
              fontSize: '14px', 
              color: '#000000', 
              lineHeight: '1.5',
              margin: '0 0 auto 0',
              flex: 1,
            }}>
              {String(testimonial.text || '')}
            </p>

            {/* Автор и город - выровнены по низу */}
            <p style={{ 
              fontSize: '14px', 
              color: '#000000', 
              fontWeight: 600,
              margin: '16px 0 0 0',
            }}>
              — {String(testimonial.author || 'Пользователь')}{testimonial.city ? `, ${testimonial.city}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
