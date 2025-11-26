// app/admin/feedback/page.tsx
// Страница обратной связи

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductFeedback {
  id: string;
  userId: string;
  productId: number;
  feedback: string;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  product: {
    id: number;
    name: string;
    brand: string;
  };
}

interface PlanFeedback {
  id: string;
  userId: string;
  rating: number;
  feedback: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

export default function FeedbackAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [productFeedback, setProductFeedback] = useState<ProductFeedback[]>([]);
  const [planFeedback, setPlanFeedback] = useState<PlanFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'plan'>('products');

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/feedback', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки обратной связи');
      }

      const data = await response.json();
      setProductFeedback(data.productFeedback || []);
      setPlanFeedback(data.planFeedback || []);
    } catch (err: any) {
      console.error('Ошибка загрузки обратной связи:', err);
      setError(err.message || 'Ошибка загрузки обратной связи');
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackLabel = (feedback: string) => {
    const labels: Record<string, { text: string; color: string; bg: string }> = {
      bought_love: { text: 'Любит', color: '#DC2626', bg: '#FEE2E2' },
      bought_ok: { text: 'OK', color: '#2563EB', bg: '#DBEAFE' },
      bought_bad: { text: 'Плохо', color: '#991B1B', bg: '#FEE2E2' },
      not_bought: { text: 'Не куплен', color: '#6B7280', bg: '#F3F4F6' },
    };
    return labels[feedback] || { text: feedback, color: '#6B7280', bg: '#F3F4F6' };
  };

  if (loading && productFeedback.length === 0 && planFeedback.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
          Обратная связь
        </h1>
        <p style={{ color: '#6B7280' }}>Отзывы пользователей о продуктах и плане</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #E5E7EB',
      }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'products' ? '2px solid #9333EA' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'products' ? '#9333EA' : '#6B7280',
            fontWeight: activeTab === 'products' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          По продуктам ({productFeedback.length})
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderBottom: activeTab === 'plan' ? '2px solid #9333EA' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'plan' ? '#9333EA' : '#6B7280',
            fontWeight: activeTab === 'plan' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          По плану ({planFeedback.length})
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Product Feedback */}
      {activeTab === 'products' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #E5E7EB',
        }}>
          {productFeedback.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
              Нет отзывов о продуктах
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {productFeedback.map((fb) => {
                const label = getFeedbackLabel(fb.feedback);
                return (
                  <div
                    key={fb.id}
                    style={{
                      padding: '20px',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>
                          {fb.user.firstName || fb.user.lastName
                            ? `${fb.user.firstName || ''} ${fb.user.lastName || ''}`.trim()
                            : fb.user.username || `ID: ${fb.user.telegramId}`}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6B7280' }}>
                          {fb.product.brand} {fb.product.name}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        backgroundColor: label.bg,
                        color: label.color,
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 600,
                      }}>
                        {label.text}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                      {new Date(fb.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Plan Feedback */}
      {activeTab === 'plan' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #E5E7EB',
        }}>
          {planFeedback.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
              Нет отзывов о плане
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {planFeedback.map((fb) => (
                <div
                  key={fb.id}
                  style={{
                    padding: '20px',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>
                        {fb.user.firstName || fb.user.lastName
                          ? `${fb.user.firstName || ''} ${fb.user.lastName || ''}`.trim()
                          : fb.user.username || `ID: ${fb.user.telegramId}`}
                      </div>
                      {fb.feedback && (
                        <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px' }}>
                          {fb.feedback}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#9333EA',
                    }}>
                      {'⭐'.repeat(fb.rating)}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    {new Date(fb.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
