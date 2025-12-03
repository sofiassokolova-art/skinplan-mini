// components/WishlistItem.tsx
// Компонент элемента избранного с обратной связью

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import FeedbackModal from './FeedbackModal';
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

interface WishlistItem {
  id: string;
  product: Product;
  feedback: string;
  createdAt: string;
}

interface WishlistItemProps {
  item: WishlistItem;
  onRemove: (productId: number) => void;
}

export default function WishlistItem({ item, onRemove }: WishlistItemProps) {
  const [feedback, setFeedback] = useState(item.feedback);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (value: string) => {
    if (value === 'bought_bad') {
      setShowFeedbackModal(true);
      return;
    }

    setLoading(true);
    try {
      await api.submitWishlistFeedback(item.product.id, value);
      setFeedback(value);
      toast.success('Спасибо за обратную связь!');
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      toast.error('Ошибка сохранения. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async (newProductId: number) => {
    setLoading(true);
    try {
      await api.replaceProductInPlan(item.product.id, newProductId);
      await api.submitWishlistFeedback(item.product.id, 'bought_bad');
      toast.success('Продукт заменён во всём плане!');
      setShowFeedbackModal(false);
      // Можно также обновить список wishlist или удалить старый продукт
      onRemove(item.product.id);
    } catch (err: any) {
      console.error('Error replacing product:', err);
      toast.error('Ошибка замены. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const marketLinks = item.product.marketLinks as any || {};
  const hasLinks = marketLinks.ozon || marketLinks.wildberries || marketLinks.apteka || item.product.link;

  return (
    <>
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Фото продукта */}
          {item.product.imageUrl && (
            <img
              src={item.product.imageUrl}
              alt={item.product.name}
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '16px',
                objectFit: 'cover',
              }}
            />
          )}

          <div style={{ flex: 1 }}>
            {/* Бренд и название */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#475467',
                marginBottom: '4px',
              }}
            >
              {item.product.brand.name}
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#0A5F59',
                marginBottom: '8px',
              }}
            >
              {item.product.name}
            </div>
            {item.product.price && (
              <div
                style={{
                  fontSize: '14px',
                  color: '#475467',
                  marginBottom: '16px',
                }}
              >
                от {item.product.price} ₽
              </div>
            )}

            {/* Ссылки на покупку */}
            {hasLinks && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {marketLinks.ozon && (
                  <a
                    href={marketLinks.ozon}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: '100px',
                      backgroundColor: '#FF6B35',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Ozon
                  </a>
                )}
                {marketLinks.wildberries && (
                  <a
                    href={marketLinks.wildberries}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: '100px',
                      backgroundColor: '#8B5CF6',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Wildberries
                  </a>
                )}
                {marketLinks.apteka && (
                  <a
                    href={marketLinks.apteka}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      minWidth: '100px',
                      backgroundColor: '#10B981',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Аптека
                  </a>
                )}
                {item.product.link && !marketLinks.ozon && !marketLinks.wildberries && !marketLinks.apteka && (
                  <a
                    href={item.product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      backgroundColor: '#0A5F59',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Купить
                  </a>
                )}
              </div>
            )}

            {/* Обратная связь */}
            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  fontSize: '13px',
                  color: '#475467',
                  marginBottom: '8px',
                }}
              >
                Как вам это средство?
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleFeedback('bought_love')}
                  disabled={loading}
                  title="Очень понравилось"
                  style={{
                    flex: 1,
                    minWidth: '60px',
                    padding: '10px',
                    borderRadius: '12px',
                    border: `2px solid ${feedback === 'bought_love' ? '#EC4899' : 'rgba(10, 95, 89, 0.2)'}`,
                    backgroundColor: feedback === 'bought_love' ? '#EC4899' : 'transparent',
                    color: feedback === 'bought_love' ? 'white' : '#0A5F59',
                    fontSize: '20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ❤️
                </button>
                <button
                  onClick={() => handleFeedback('bought_ok')}
                  disabled={loading}
                  title="Нормально"
                  style={{
                    flex: 1,
                    minWidth: '60px',
                    padding: '10px',
                    borderRadius: '12px',
                    border: `2px solid ${feedback === 'bought_ok' ? '#3B82F6' : 'rgba(10, 95, 89, 0.2)'}`,
                    backgroundColor: feedback === 'bought_ok' ? '#3B82F6' : 'transparent',
                    color: feedback === 'bought_ok' ? 'white' : '#0A5F59',
                    fontSize: '20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={() => handleFeedback('bought_bad')}
                  disabled={loading}
                  title="Не понравилось"
                  style={{
                    flex: 1,
                    minWidth: '60px',
                    padding: '10px',
                    borderRadius: '12px',
                    border: `2px solid ${feedback === 'bought_bad' ? '#374151' : 'rgba(10, 95, 89, 0.2)'}`,
                    backgroundColor: feedback === 'bought_bad' ? '#374151' : 'transparent',
                    color: feedback === 'bought_bad' ? 'white' : '#0A5F59',
                    fontSize: '20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
              {feedback === 'not_bought' && (
                <button
                  onClick={() => handleFeedback('bought_love')}
                  disabled={loading}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '2px dashed rgba(139, 92, 246, 0.3)',
                    backgroundColor: 'transparent',
                    color: '#8B5CF6',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Я уже купил(а) это средство
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Удалить из избранного */}
        <button
          onClick={() => onRemove(item.product.id)}
          disabled={loading}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#9CA3AF',
            fontSize: '13px',
            textDecoration: 'underline',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Убрать из избранного
        </button>
      </div>

      {/* Модалка с альтернативами */}
      <FeedbackModal
        product={item.product}
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onReplace={handleReplace}
      />
    </>
  );
}

