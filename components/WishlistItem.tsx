// components/WishlistItem.tsx
// Компонент элемента избранного с обратной связью

'use client';

import { useState, useEffect } from 'react';
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
  const [isInCart, setIsInCart] = useState(false);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);

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

  // Проверяем статус корзины при монтировании
  useEffect(() => {
    const checkCartStatus = async () => {
      try {
        const cart = await api.getCart() as { items?: Array<{ product: { id: number }; quantity: number }> };
        const items = cart.items || [];
        const cartItem = items.find((cartItem) => cartItem.product.id === item.product.id);
        if (cartItem) {
          setIsInCart(true);
          setCartQuantity(cartItem.quantity);
        } else {
          setIsInCart(false);
          setCartQuantity(0);
        }
      } catch (err) {
        console.warn('Could not check cart status:', err);
      }
    };
    
    checkCartStatus();
  }, [item.product.id]);

  const handleAddToCart = async () => {
    if (cartLoading) return;
    
    setCartLoading(true);
    try {
      if (isInCart) {
        await api.removeFromCart(item.product.id);
        setIsInCart(false);
        setCartQuantity(0);
        toast.success('Удалено из корзины');
      } else {
        await api.addToCart(item.product.id, 1);
        setIsInCart(true);
        setCartQuantity(1);
        toast.success('Добавлено в корзину');
      }
      
      // Перезагружаем корзину для актуальных данных
      const cart = await api.getCart() as { items?: Array<{ product: { id: number }; quantity: number }> };
      const items = cart.items || [];
      const cartItem = items.find((cartItem) => cartItem.product.id === item.product.id);
      if (cartItem) {
        setCartQuantity(cartItem.quantity);
      }
    } catch (err: any) {
      console.error('Error toggling cart:', err);
      toast.error(err?.message || 'Ошибка при изменении корзины');
    } finally {
      setCartLoading(false);
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

            {/* Кнопка добавления в корзину */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <button
                onClick={handleAddToCart}
                disabled={cartLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: cartLoading ? 'not-allowed' : 'pointer',
                  opacity: cartLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                  position: 'relative',
                }}
              >
                {cartLoading ? (
                  'Загрузка...'
                ) : isInCart ? (
                  <>
                    <span>✓</span>
                    <span>В корзине</span>
                  </>
                ) : (
                  <>
                    <span>🛒</span>
                    <span>В корзину</span>
                  </>
                )}
                {cartQuantity > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: '#EF4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '2px solid white',
                      minWidth: '22px',
                    }}
                  >
                    {cartQuantity}
                  </span>
                )}
              </button>
            </div>

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

            {/* Обратная связь - показывается только если еще не заполнена */}
            {!feedback || feedback === 'not_bought' ? (
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
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleFeedback('bought_love')}
                    disabled={loading}
                    title="Понравилось"
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: '2px solid rgba(10, 95, 89, 0.2)',
                      backgroundColor: 'transparent',
                      color: '#0A5F59',
                      fontSize: '24px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleFeedback('bought_bad')}
                    disabled={loading}
                    title="Не понравилось"
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: '2px solid rgba(10, 95, 89, 0.2)',
                      backgroundColor: 'transparent',
                      color: '#0A5F59',
                      fontSize: '24px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    👎
                  </button>
                </div>
              </div>
            ) : null}
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

