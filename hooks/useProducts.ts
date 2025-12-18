// hooks/useProducts.ts
// Хук для загрузки продуктов по их ID

import { useState, useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';

interface Product {
  id: number;
  name: string;
  brand: { name: string };
  price?: number | null;
  imageUrl?: string | null;
  description?: string;
}

interface UseProductsResult {
  products: Map<number, Product>;
  isLoading: boolean;
  error: Error | null;
  loadProducts: (productIds: number[]) => Promise<void>;
}

/**
 * Хук для загрузки продуктов по их ID
 * Дедуплицирует запросы и кэширует результаты
 */
export function useProducts(initialProductIds?: number[]): UseProductsResult {
  const [products, setProducts] = useState<Map<number, Product>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadInProgressRef = useRef(false);
  const loadedIdsRef = useRef<Set<number>>(new Set());

  const loadProducts = async (productIds: number[]) => {
    // Фильтруем уже загруженные продукты
    const idsToLoad = productIds.filter(id => !loadedIdsRef.current.has(id));
    
    if (idsToLoad.length === 0) {
      return; // Все продукты уже загружены
    }

    // Защита от множественных одновременных запросов
    if (loadInProgressRef.current) {
      return;
    }

    loadInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      
      const response = await fetch('/api/products/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
        },
        body: JSON.stringify({ productIds: idsToLoad }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to load products: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const newProducts = new Map(products);

      if (data.products && Array.isArray(data.products)) {
        data.products.forEach((p: any) => {
          if (p && p.id) {
            newProducts.set(p.id, {
              id: p.id,
              name: p.name || 'Неизвестный продукт',
              brand: { name: p.brand?.name || p.brand || 'Unknown' },
              price: p.price || null,
              imageUrl: p.imageUrl || null,
              description: p.descriptionUser || p.description || null,
            });
            loadedIdsRef.current.add(p.id);
          }
        });
      }

      setProducts(newProducts);
      
      clientLogger.log('Products loaded', {
        requested: idsToLoad.length,
        loaded: data.products?.length || 0,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      clientLogger.error('Error loading products', error);
      setError(error);
    } finally {
      setIsLoading(false);
      loadInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (initialProductIds && initialProductIds.length > 0) {
      loadProducts(initialProductIds);
    }
  }, []); // Загружаем только при монтировании

  return {
    products,
    isLoading,
    error,
    loadProducts,
  };
}
