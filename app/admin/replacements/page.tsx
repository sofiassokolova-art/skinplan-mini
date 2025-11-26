// app/admin/replacements/page.tsx
// Страница замен продуктов

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Replacement {
  id: string;
  userId: string;
  oldProductId: number;
  newProductId: number;
  reason: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  oldProduct: {
    id: number;
    name: string;
    brand: string;
  };
  newProduct: {
    id: number;
    name: string;
    brand: string;
  };
}

export default function ReplacementsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReplacements();
  }, []);

  const loadReplacements = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/replacements', {
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
        throw new Error('Ошибка загрузки замен');
      }

      const data = await response.json();
      setReplacements(data.replacements || []);
    } catch (err: any) {
      console.error('Ошибка загрузки замен:', err);
      setError(err.message || 'Ошибка загрузки замен');
    } finally {
      setLoading(false);
    }
  };

  if (loading && replacements.length === 0) {
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
          Замены продуктов ({replacements.length})
        </h1>
        <p style={{ color: '#6B7280' }}>История замен продуктов в планах пользователей</p>
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

      {/* Replacements List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E5E7EB',
      }}>
        {replacements.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
            Нет замен продуктов
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {replacements.map((replacement) => (
              <div
                key={replacement.id}
                style={{
                  padding: '20px',
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                      {replacement.user.firstName || replacement.user.lastName
                        ? `${replacement.user.firstName || ''} ${replacement.user.lastName || ''}`.trim()
                        : replacement.user.username || `ID: ${replacement.user.telegramId}`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#991B1B',
                        backgroundColor: '#FEE2E2',
                        padding: '6px 12px',
                        borderRadius: '8px',
                      }}>
                        ❌ {replacement.oldProduct.brand} {replacement.oldProduct.name}
                      </div>
                      <span style={{ color: '#6B7280', fontSize: '18px' }}>→</span>
                      <div style={{
                        fontSize: '14px',
                        color: '#065F46',
                        backgroundColor: '#D1FAE5',
                        padding: '6px 12px',
                        borderRadius: '8px',
                      }}>
                        ✓ {replacement.newProduct.brand} {replacement.newProduct.name}
                      </div>
                    </div>
                    {replacement.reason && (
                      <div style={{
                        fontSize: '14px',
                        color: '#6B7280',
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '8px',
                      }}>
                        Причина: {replacement.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                    {new Date(replacement.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
