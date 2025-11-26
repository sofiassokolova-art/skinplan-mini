// components/ReplaceProductModal.tsx
// Модалка замены продукта

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
}

interface AlternativeProduct {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
  whyBetter: string;
}

interface ReplaceProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (oldProductId: number, newProductId: number) => void;
}

export function ReplaceProductModal({ product, isOpen, onClose, onReplace }: ReplaceProductModalProps) {
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      loadAlternatives();
    }
  }, [isOpen, product]);

  const loadAlternatives = async () => {
    if (!product) return;

    try {
      setLoading(true);
      const data = await api.getProductAlternatives(product.id) as { alternatives: AlternativeProduct[] };
      setAlternatives(data.alternatives || []);
    } catch (err: any) {
      console.error('Error loading alternatives:', err);
      toast.error('Не удалось загрузить альтернативы');
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async () => {
    if (!product || !selectedAlternative) return;

    try {
      await api.replaceProductInPlan(product.id, selectedAlternative);
      toast.success('Продукт заменен в плане');
      onReplace(product.id, selectedAlternative);
      onClose();
    } catch (err: any) {
      console.error('Error replacing product:', err);
      toast.error('Не удалось заменить продукт');
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
          }}>
            Заменить продукт
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#F3F4F6',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Текущий продукт */}
        <div style={{
          backgroundColor: '#FEE2E2',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <div style={{ fontWeight: 600, color: '#991B1B', marginBottom: '8px' }}>
            Текущий продукт
          </div>
          <div style={{ fontSize: '16px', color: '#1F2937' }}>
            {product.brand.name} {product.name}
          </div>
        </div>

        {/* Альтернативы */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #E5E7EB',
              borderTop: '4px solid #8B5CF6',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        ) : alternatives.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Альтернативы не найдены
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => setSelectedAlternative(alt.id)}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: selectedAlternative === alt.id ? '2px solid #8B5CF6' : '1px solid #E5E7EB',
                  backgroundColor: selectedAlternative === alt.id ? '#F3F4F6' : 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>
                  {alt.brand.name} {alt.name}
                </div>
                {alt.price && (
                  <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                    {alt.price} ₽
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#8B5CF6' }}>
                  {alt.whyBetter}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              backgroundColor: 'white',
              color: '#6B7280',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleReplace}
            disabled={!selectedAlternative || loading}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: selectedAlternative && !loading ? '#8B5CF6' : '#D1D5DB',
              color: 'white',
              fontWeight: 600,
              cursor: selectedAlternative && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            Заменить
          </button>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

