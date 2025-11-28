// components/RecommendedProducts.tsx
// Компонент для отображения рекомендованных средств

'use client';

import { useState, useEffect } from 'react';
import { AddToCartButton } from './AddToCartButton';
import { AddToCartButtonNew } from './AddToCartButtonNew';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  brand: {
    id: number;
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
  link: string | null;
  marketLinks: any;
}

interface RecommendedProductsProps {
  wishlistProductIds: Set<number>;
  onToggleWishlist: (productId: number) => void;
  onOpenReplace: (product: any) => void;
}

export function RecommendedProducts({ 
  wishlistProductIds, 
  onToggleWishlist,
  onOpenReplace 
}: RecommendedProductsProps) {
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartProductIds, setCartProductIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadRecommendations();
    loadCart();
  }, []);

  const loadRecommendations = async () => {
    try {
      const data = await api.getRecommendations() as any;
      // Рекомендации могут быть в разных форматах
      const products = data.products || data.recommendations || data || [];
      setRecommendedProducts(Array.isArray(products) ? products.slice(0, 6) : []);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setRecommendedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      const data = await api.getCart() as any;
      const items = data.items || [];
      const productIds = new Set<number>(items.map((item: any) => item.product.id as number));
      setCartProductIds(productIds);
    } catch (err) {
      console.error('Error loading cart:', err);
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      await api.addToCart(productId, 1);
      setCartProductIds(prev => new Set(prev).add(productId));
      toast.success('Добавлено в корзину');
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      toast.error(err?.message || 'Ошибка при добавлении в корзину');
    }
  };

  const handleRemoveFromCart = async (productId: number) => {
    try {
      await api.removeFromCart(productId);
      setCartProductIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
      toast.success('Удалено из корзины');
    } catch (err: any) {
      console.error('Error removing from cart:', err);
      toast.error(err?.message || 'Ошибка при удалении из корзины');
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-[28px] rounded-3xl p-6 border border-white/40 shadow-xl mb-6">
        <div className="text-center text-gray-500">Загрузка рекомендаций...</div>
      </div>
    );
  }

  // Всегда показываем секцию, даже если нет рекомендаций
  if (recommendedProducts.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-[28px] rounded-3xl p-6 border border-white/40 shadow-xl mb-6">
        <h3 className="text-2xl font-bold text-[#0A5F59] mb-6">
          Рекомендованные средства
        </h3>
        <div className="text-center text-gray-500 py-8">
          Рекомендации загружаются...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-[28px] rounded-3xl p-6 border border-white/40 shadow-xl mb-6">
      <h3 className="text-2xl font-bold text-[#0A5F59] mb-6">
        Рекомендованные средства
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {recommendedProducts.map((product) => {
          const isInWishlist = wishlistProductIds.has(product.id);
          const isInCart = cartProductIds.has(product.id);

          return (
            <div
              key={product.id}
              className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-200"
            >
              <div className="flex gap-4">
                {/* Изображение продукта */}
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-xl"
                  />
                )}

                {/* Информация о продукте */}
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-[#0A5F59] mb-1">
                    {product.name}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {product.brand.name} {product.price && `• ${product.price} ₽`}
                  </p>

                  {/* Кнопки действий */}
                  <div className="flex gap-2 flex-wrap">
                    <AddToCartButton
                      productId={product.id}
                      isActive={isInWishlist}
                      onToggle={onToggleWishlist}
                    />
                    <AddToCartButtonNew
                      productId={product.id}
                      isInCart={isInCart}
                      onToggle={(productId) => {
                        if (isInCart) {
                          handleRemoveFromCart(productId);
                        } else {
                          handleAddToCart(productId);
                        }
                      }}
                    />
                    <button
                      onClick={() => onOpenReplace({
                        id: product.id,
                        name: product.name,
                        brand: product.brand,
                        price: product.price || 0,
                        imageUrl: product.imageUrl,
                      })}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                    >
                      Заменить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

