// components/AddToCartButton.tsx
// Кнопка добавления в избранное

'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface AddToCartButtonProps {
  productId: number;
  isActive: boolean;
  onToggle?: (productId: number) => void;
}

export function AddToCartButton({ productId, isActive, onToggle }: AddToCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [active, setActive] = useState(isActive);

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const newState = !active;
      
      // Импортируем API динамически (client-side only)
      const { api } = await import('@/lib/api');
      
      if (newState) {
        await api.addToWishlist(productId);
        toast.success('Добавлено в избранное');
      } else {
        await api.removeFromWishlist(productId);
        toast.success('Удалено из избранного');
      }
      
      setActive(newState);
      onToggle?.(productId);
    } catch (err: any) {
      console.error('Error toggling wishlist:', err);
      toast.error(err?.message || 'Ошибка при изменении избранного');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={active ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      {active ? '✓' : '🛍️'}
    </button>
  );
}
