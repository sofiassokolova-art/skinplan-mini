// components/FeedbackModal.tsx
// Модалка с альтернативами продукта при нажатии "Bad"

'use client';

import { useState, useEffect } from 'react';
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
}

interface Alternative {
  id: number;
  name: string;
  brand: {
    id: number;
    name: string;
  };
  price: number | null;
  imageUrl: string | null;
  description?: string;
  whyBetter: string;
}

interface FeedbackModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (newProductId: number) => Promise<void>;
}

export default function FeedbackModal({
  product,
  isOpen,
  onClose,
  onReplace,
}: FeedbackModalProps) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlt, setSelectedAlt] = useState<Alternative | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  useEffect(() => {
    if (isOpen && product.id) {
      loadAlternatives();
    }
  }, [isOpen, product.id]);

  const loadAlternatives = async () => {
    setLoadingAlternatives(true);
    try {
      const response = await api.getProductAlternatives(product.id) as {
        alternatives?: Alternative[];
      };
      setAlternatives(response?.alternatives || []);
    } catch (err: any) {
      console.error('Error loading alternatives:', err);
      toast.error('Не удалось загрузить альтернативы');
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleReplace = async () => {
    if (!selectedAlt) return;
    setLoading(true);
    try {
      await onReplace(selectedAlt.id);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>😔</div>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '8px' }}>
            Жаль, что {product.name} не подошло
          </h3>
          <p style={{ fontSize: '16px', color: '#475467' }}>
            Мы подберём идеальную альтернативу под вашу кожу
          </p>
        </div>

        {loadingAlternatives ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '18px', color: '#475467' }}>Загрузка альтернатив...</div>
          </div>
        ) : alternatives.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '18px', color: '#475467' }}>
              К сожалению, альтернативы не найдены
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => setSelectedAlt(alt)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  border: `2px solid ${
                    selectedAlt?.id === alt.id ? '#8B5CF6' : 'rgba(10, 95, 89, 0.2)'
                  }`,
                  backgroundColor: selectedAlt?.id === alt.id ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '16px' }}>
                  {alt.imageUrl && (
                    <img
                      src={alt.imageUrl}
                      alt={alt.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#475467', marginBottom: '4px' }}>
                      {alt.brand.name}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '8px' }}>
                      {alt.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '8px',
                      }}
                    >
                      <span>✓</span> Почему лучше: {alt.whyBetter}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              border: '2px solid rgba(10, 95, 89, 0.3)',
              backgroundColor: 'transparent',
              color: '#0A5F59',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleReplace}
            disabled={!selectedAlt || loading}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(to right, #8B5CF6, #EC4899)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: !selectedAlt || loading ? 'not-allowed' : 'pointer',
              opacity: !selectedAlt || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Заменяем...' : 'Заменить во всём плане'}
          </button>
        </div>
      </div>
    </div>
  );
}

