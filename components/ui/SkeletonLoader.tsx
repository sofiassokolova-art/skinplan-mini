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
    baseStyle.animation = 'pulse-subtle 1.5s ease-in-out infinite';
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
    </div>
  );
}

export function ButtonSkeleton({
  width = '116px',
  height = '16px',
  light = false,
}: {
  width?: string | number;
  height?: string | number;
  light?: boolean;
}) {
  return (
    <SkeletonLoader
      variant="rectangular"
      width={width}
      height={height}
      borderRadius="999px"
      style={{
        margin: '0 auto',
        backgroundColor: light ? 'rgba(255, 255, 255, 0.42)' : 'rgba(10, 10, 10, 0.16)',
      }}
    />
  );
}

export function InlineListSkeleton({
  rows = 3,
  dense = false,
}: {
  rows?: number;
  dense?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? '10px' : '12px' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: dense ? '44px minmax(0, 1fr)' : '64px minmax(0, 1fr)',
            gap: '12px',
            alignItems: 'center',
            padding: dense ? '10px' : '12px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.62)',
            border: '1px solid rgba(229, 231, 235, 0.8)',
          }}
        >
          <SkeletonLoader
            variant="rectangular"
            width={dense ? '44px' : '64px'}
            height={dense ? '44px' : '64px'}
            borderRadius="8px"
          />
          <div>
            <SkeletonLoader
              variant="text"
              lines={1}
              width="72%"
              height={dense ? '12px' : '14px'}
              style={{ marginBottom: '8px' }}
            />
            <SkeletonLoader
              variant="text"
              lines={1}
              width={index % 2 === 0 ? '92%' : '58%'}
              height={dense ? '10px' : '12px'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniAppPageSkeleton({
  background = '#F4F2EE',
  rows = 4,
  paddingBottom = '120px',
  showTopBar = true,
}: {
  background?: string;
  rows?: number;
  paddingBottom?: string;
  showTopBar?: boolean;
}) {
  return (
    <div
      className="app-bottom-nav-clearance"
      style={{
        minHeight: '100vh',
        background,
        backgroundAttachment: 'fixed',
        padding: `8px 20px ${paddingBottom}`,
        boxSizing: 'border-box',
      }}
      aria-hidden="true"
    >
      {showTopBar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0 14px',
          }}
        >
          <SkeletonLoader variant="rectangular" width="92px" height="22px" borderRadius="8px" />
          <SkeletonLoader variant="circular" width="40px" height="40px" />
        </div>
      )}

      <SkeletonLoader
        variant="rectangular"
        width="52%"
        height="32px"
        borderRadius="8px"
        style={{ margin: '6px 0 18px' }}
      />

      <InlineListSkeleton rows={rows} />
    </div>
  );
}

export function AdminPageSkeleton({
  cards = 4,
  rows = 5,
  className = '',
}: {
  cards?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-6 pt-8 ${className}`} aria-hidden="true">
      <div>
        <SkeletonLoader variant="rectangular" width="240px" height="40px" borderRadius="8px" />
        <SkeletonLoader
          variant="rectangular"
          width="320px"
          height="16px"
          borderRadius="8px"
          style={{ marginTop: '12px' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <SkeletonLoader variant="rectangular" width="44%" height="14px" borderRadius="8px" />
            <SkeletonLoader
              variant="rectangular"
              width={index % 2 === 0 ? '66%' : '52%'}
              height="30px"
              borderRadius="8px"
              style={{ marginTop: '14px' }}
            />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <SkeletonLoader variant="rectangular" width="36%" height="18px" borderRadius="8px" style={{ marginBottom: '18px' }} />
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonLoader
              key={index}
              variant="rectangular"
              width="100%"
              height="44px"
              borderRadius="8px"
            />
          ))}
        </div>
      </div>
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
