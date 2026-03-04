// components/quiz/content/TestimonialsCarousel.tsx
// Компонент для отображения отзывов с горизонтальным скроллом
// fullWidth: режим для экрана отзывов — фото на всю ширину, одна карточка на экран, точки

import React, { useRef, useState, useCallback, memo } from 'react';
import Image from 'next/image';
import type { Testimonial } from '@/app/(miniapp)/quiz/info-screens';

export interface TestimonialsCarouselProps {
  testimonials: Testimonial[];
  /** Режим экрана отзывов: фото сверху на всю ширину, scroll-snap, точки */
  fullWidth?: boolean;
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

function TestimonialsCarouselInner({ testimonials, fullWidth }: TestimonialsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || testimonials.length === 0) return;
    const cardWidth = el.clientWidth || el.scrollWidth / testimonials.length;
    const index = Math.round(el.scrollLeft / cardWidth);
    const clamped = Math.max(0, Math.min(index, testimonials.length - 1));
    setActiveIndex((prev) => (prev !== clamped ? clamped : prev));
  }, [testimonials.length]);

  const goTo = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el || testimonials.length === 0) return;
    const cardWidth = el.scrollWidth / testimonials.length;
    el.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
    setActiveIndex(index);
  }, [testimonials.length]);

  if (!testimonials || !Array.isArray(testimonials) || testimonials.length === 0) {
    return null;
  }

  // Режим экрана отзывов: одна карточка на экран, фото на всю ширину, точки
  if (fullWidth) {
    return (
      <div style={{ marginBottom: '28px' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 0 12px 0',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          {testimonials.map((testimonial, idx: number) => (
            <div
              key={`t-${idx}-${testimonial.beforeImage ?? ''}-${testimonial.afterImage ?? ''}`}
              style={{
                minWidth: '100%',
                width: '100%',
                flexShrink: 0,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                paddingRight: 0,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
                {(testimonial.beforeImage || testimonial.afterImage) && (
                  <div style={{
                    display: 'flex',
                    width: '100vw',
                    marginLeft: 'calc(-50vw + 50%)',
                    minHeight: '60vh',
                    maxHeight: '70vh',
                    height: '64vh',
                    overflow: 'hidden',
                    borderBottomLeftRadius: '20px',
                    borderBottomRightRadius: '20px',
                    // ФИКС: уменьшаем мигание картинок при скролле
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                    willChange: 'transform',
                  }}>
                    {testimonial.beforeImage && (
                      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottomLeftRadius: '20px' }}>
                        <img
                          src={testimonial.beforeImage}
                          alt="До"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                        />
                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#FFFFFF', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>До</div>
                      </div>
                    )}
                    {testimonial.afterImage && (
                      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottomRightRadius: '20px' }}>
                        <img
                          src={testimonial.afterImage}
                          alt="После"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                        />
                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: '#D5FE61', color: '#000000', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>После</div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ padding: '12px 20px 10px', display: 'flex', flexDirection: 'column', flex: 1, maxWidth: '340px', margin: '0 auto' }}>
                  <p style={{ fontSize: '14px', color: '#000000', fontWeight: 600, margin: '0 0 6px 0' }}>
                    {String(testimonial.author || 'Пользователь')}{testimonial.city ? `, ${testimonial.city}` : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: '#000000', lineHeight: '1.5', margin: '0 0 auto 0', flex: 1 }}>
                    {String(testimonial.text || '')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', paddingTop: 0, paddingBottom: 0, marginTop: '-8px' }}>
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={`Отзыв ${idx + 1}`}
              style={{
                width: activeIndex === idx ? 10 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                backgroundColor: activeIndex === idx ? '#000000' : 'rgba(0, 0, 0, 0.35)',
                transition: 'background-color 0.2s, width 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '16px', 
      overflowX: 'auto',
      overflowY: 'visible', // Разрешаем видимость тени сверху/снизу
      padding: '12px 0', // Увеличено для тени
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
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', // Уменьшена тень
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
                  <Image
                    src={testimonial.beforeImage}
                    alt="До"
                    width={300} // ФИКС: Фиксированные размеры для избежания layout shift
                    height={120}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block', // ФИКС: Предотвращает "пиксельную полоску" из-за baseline
                    }}
                    sizes="150px"
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
                    zIndex: 1,
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
                  <Image
                    src={testimonial.afterImage}
                    alt="После"
                    width={300} // ФИКС: Фиксированные размеры для избежания layout shift
                    height={120}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block', // ФИКС: Предотвращает "пиксельную полоску" из-за baseline
                    }}
                    sizes="150px"
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
                    zIndex: 1,
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

export const TestimonialsCarousel = memo(TestimonialsCarouselInner);
