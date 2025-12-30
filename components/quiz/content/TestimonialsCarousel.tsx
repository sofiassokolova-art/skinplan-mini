// components/quiz/content/TestimonialsCarousel.tsx
// Компонент для отображения отзывов с горизонтальным скроллом
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import type { Testimonial } from '@/app/(miniapp)/quiz/info-screens';

export interface TestimonialsCarouselProps {
  testimonials: Testimonial[];
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
      scrollbarWidth: 'thin',
      WebkitOverflowScrolling: 'touch',
      msOverflowStyle: '-ms-autohiding-scrollbar',
    }}>
      {testimonials.map((testimonial, idx: number) => (
        <div key={idx} style={{
          minWidth: '280px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '18px', marginBottom: '12px' }}>
            {'⭐'.repeat(testimonial.stars || 5)}
          </div>
          <p style={{ fontSize: '14px', color: '#475467', marginBottom: '16px', lineHeight: '1.5' }}>
            "{String(testimonial.text || '')}"
          </p>
          <p style={{ fontSize: '12px', color: '#0A5F59', fontWeight: 600 }}>
            — {String(testimonial.author || 'Пользователь')}
          </p>
        </div>
      ))}
    </div>
  );
}

