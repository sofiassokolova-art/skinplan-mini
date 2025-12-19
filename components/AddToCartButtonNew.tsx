// components/AddToCartButtonNew.tsx
// Кнопка добавления в корзину

'use client';

import { useState } from 'react';
import { useAddToCart, useRemoveFromCart } from '@/hooks/useCart';
import toast from 'react-hot-toast';

interface AddToCartButtonNewProps {
  productId: number;
  isInCart?: boolean;
  onToggle?: (productId: number) => void;
}

export function AddToCartButtonNew({ productId, isInCart = false, onToggle }: AddToCartButtonNewProps) {
  const [active, setActive] = useState(isInCart);
  // ИСПРАВЛЕНО: Используем React Query хуки для автоматической инвалидации кэша
  const addToCartMutation = useAddToCart();
  const removeFromCartMutation = useRemoveFromCart();
  const isLoading = addToCartMutation.isPending || removeFromCartMutation.isPending;

  const handleClick = async () => {
    if (isLoading) return;
    
    try {
      if (active) {
        await removeFromCartMutation.mutateAsync(productId);
        toast.success('Удалено из корзины');
        setActive(false);
      } else {
        await addToCartMutation.mutateAsync({ productId, quantity: 1 });
        toast.success('Добавлено в корзину');
        setActive(true);
      }
      
      onToggle?.(productId);
    } catch (err: any) {
      console.error('Error toggling cart:', err);
      toast.error(err?.message || 'Ошибка при изменении корзины');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={active ? 'Удалить из корзины' : 'Добавить в корзину'}
    >
      {active ? '✓ В корзине' : '🛒 В корзину'}
    </button>
  );
}

