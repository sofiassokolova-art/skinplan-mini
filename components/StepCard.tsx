// components/StepCard.tsx
// Карточка шага ухода с продуктом

'use client';

import { useState } from 'react';
import { Heart, ShoppingCart, RefreshCw } from 'lucide-react';
import type { DayStep } from '@/lib/plan-types';
import { getStepCategoryLabel, getStepDescription } from '@/lib/plan-types';

interface StepCardProps {
  step: DayStep;
  product?: {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  } | null;
  isInWishlist?: boolean;
  cartQuantity?: number; // Количество товара в корзине
  onToggleWishlist?: (productId: number) => void;
  onAddToCart?: (productId: number) => void;
  onReplace?: (step: DayStep, productId: number) => void;
  skinIssues?: string[]; // ID проблем кожи для формирования описаний
  showTags?: boolean; // Показывать ли теги (по умолчанию true)
}

export function StepCard({
  step,
  product,
  isInWishlist = false,
  cartQuantity = 0,
  onToggleWishlist,
  onAddToCart,
  onReplace,
  skinIssues,
  showTags = true,
}: StepCardProps) {
  const stepDesc = getStepDescription(step.stepCategory, skinIssues);

  if (!product) {
    return (
      <div style={{
        padding: '16px',
        borderRadius: '16px',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B7280', marginBottom: '8px' }}>
          {stepDesc.name}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px', fontStyle: 'italic' }}>
          {stepDesc.subtitle}
        </div>
        <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
          Продукт не найден
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      borderRadius: '16px',
      backgroundColor: 'white',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Заголовок шага */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#0A5F59', marginBottom: '4px' }}>
          {stepDesc.name}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontStyle: 'italic' }}>
          {stepDesc.subtitle}
        </div>
        {/* Теги шага */}
        {showTags && stepDesc.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
            {stepDesc.tags.map((tag, idx) => (
              <span
                key={idx}
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
        )}
      </div>

      {/* Информация о продукте */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
          {product.name}
        </div>
        <div style={{ fontSize: '14px', color: '#6B7280' }}>
          {product.brand.name}
          {product.price && ` • ${product.price} ₽`}
        </div>
      </div>

      {/* Кнопки действий */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {onToggleWishlist && (
          <button
            onClick={() => onToggleWishlist(product.id)}
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
            onClick={() => onAddToCart(product.id)}
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
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = cartQuantity > 0 ? '#059669' : '#0C7A73';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = cartQuantity > 0 ? '#10B981' : '#0A5F59';
            }}
          >
            <ShoppingCart size={16} />
            <span>{cartQuantity > 0 ? 'В корзине' : 'В корзину'}</span>
            {cartQuantity > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  border: '2px solid white',
                }}
              >
                {cartQuantity}
              </span>
            )}
          </button>
        )}

        {onReplace && (
          <button
            onClick={() => onReplace(step, product.id)}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: '1px solid #E5E7EB',
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
              e.currentTarget.style.borderColor = '#9CA3AF';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            <RefreshCw size={16} />
            Заменить
          </button>
        )}
      </div>
    </div>
  );
}

