// components/quiz/content/ProductsGrid.tsx
// Компонент для отображения продуктов в виде сетки
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import type { InfoScreenProduct } from '@/app/(miniapp)/quiz/info-screens';

export interface ProductsGridProps {
  products: InfoScreenProduct[];
}

export function ProductsGrid({ products }: ProductsGridProps) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
      {products.map((product, idx: number) => (
        <div key={idx} style={{
          flex: '1 1 100px',
          minWidth: '100px',
          maxWidth: '120px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '16px',
          padding: '16px',
          textAlign: 'center',
        }}>
          {product.icon && (
            <img src={product.icon} alt={product.name} style={{ width: '60px', height: '60px', marginBottom: '8px', objectFit: 'contain' }} />
          )}
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0A5F59', marginBottom: '4px' }}>
            {String(product.name || 'Продукт')}
          </div>
          <div style={{ fontSize: '10px', color: '#475467' }}>
            {String(product.desc || '')}
          </div>
        </div>
      ))}
    </div>
  );
}

