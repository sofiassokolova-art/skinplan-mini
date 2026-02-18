// components/ui/SkeletonLoader.tsx
// Универсальный компонент для skeleton loaders
// Используется для улучшения UX при загрузке данных

'use client';

import React from 'react';

export interface SkeletonLoaderProps {
  /** Количество строк для текстового скелетона */
  lines?: number;
  /** Ширина скелетона (в процентах или пикселях) */
  width?: string | number;
  /** Высота скелетона (в пикселях) */
  height?: string | number;
  /** Скругление углов */
  borderRadius?: string | number;
  /** Анимация пульсации */
  animated?: boolean;
  /** Дополнительные стили */
  className?: string;
  /** Встроенные стили */
  style?: React.CSSProperties;
  /** Тип скелетона */
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
}

/**
 * Универсальный компонент Skeleton Loader
 * Используется для отображения placeholder контента во время загрузки
 */
export function SkeletonLoader({
  lines = 1,
  width = '100%',
  height,
  borderRadius = '4px',
  animated = true,
  className = '',
  style,
  variant = 'text',
}: SkeletonLoaderProps) {
  const baseStyle: React.CSSProperties = {
    backgroundColor: '#E5E7EB',
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    ...style,
  };

  if (animated) {
    baseStyle.animation = 'pulse 1.5s ease-in-out infinite';
  }

  // Циркулярный скелетон (для аватаров)
  if (variant === 'circular') {
    const size = height || width || '40px';
    return (
      <div
        className={className}
        style={{
          ...baseStyle,
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
          borderRadius: '50%',
        }}
      />
    );
  }

  // Прямоугольный скелетон
  if (variant === 'rectangular') {
    return (
      <div
        className={className}
        style={{
          ...baseStyle,
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height || '100px',
        }}
      />
    );
  }

  // Карточка скелетон
  if (variant === 'card') {
    return (
      <div
        className={className}
        style={{
          ...baseStyle,
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height || '200px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#D1D5DB',
              height: '12px',
              borderRadius: '4px',
              width: i === lines - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  // Текстовый скелетон (по умолчанию)
  return (
    <div className={className} style={{ width: typeof width === 'number' ? `${width}px` : width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...baseStyle,
            height: height || '16px',
            marginBottom: i < lines - 1 ? '8px' : 0,
            width: i === lines - 1 ? '80%' : '100%',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Компонент для skeleton loader списка вопросов
 */
export function QuestionSkeleton() {
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <SkeletonLoader variant="text" lines={1} width="60%" height="24px" style={{ marginBottom: '24px' }} />
      <SkeletonLoader variant="text" lines={3} width="100%" style={{ marginBottom: '32px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLoader
            key={i}
            variant="rectangular"
            width="100%"
            height="48px"
            borderRadius="8px"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Компонент для skeleton loader плана
 */
export function PlanSkeleton() {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <SkeletonLoader variant="text" lines={1} width="40%" height="32px" style={{ marginBottom: '24px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLoader key={i} variant="card" width="100%" height="250px" />
        ))}
      </div>
    </div>
  );
}

/**
 * Компонент для skeleton loader рутины (routine items)
 * Используется на главной странице при загрузке плана
 */
export function RoutineSkeleton() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '0 20px',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Step Number Circle */}
          <SkeletonLoader variant="circular" width="32px" height="32px" />
          
          {/* Icon */}
          <SkeletonLoader variant="rectangular" width="60px" height="60px" borderRadius="8px" />
          
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonLoader variant="text" lines={1} width="60%" height="17px" style={{ marginBottom: '8px' }} />
            <SkeletonLoader variant="text" lines={1} width="80%" height="14px" />
          </div>
          
          {/* Info Button */}
          <SkeletonLoader variant="circular" width="28px" height="28px" />
        </div>
      ))}
    </div>
  );
}
