// app/admin/users/page.tsx
// Страница управления пользователями

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
  createdAt: string;
  updatedAt: string;
  hasProfile: boolean;
  hasPlan: boolean;
  profileCount: number;
  planCount: number;
  feedbackCount: number;
  latestProfile: any | null;
}

export default function UsersAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/users?page=${page}&limit=50`, {
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
        throw new Error('Ошибка загрузки пользователей');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей:', err);
      setError(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (u.firstName?.toLowerCase().includes(query)) ||
      (u.lastName?.toLowerCase().includes(query)) ||
      (u.username?.toLowerCase().includes(query)) ||
      (u.telegramId?.includes(query))
    );
  });

  if (loading && users.length === 0) {
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
            Пользователи ({filteredUsers.length})
          </h1>
          <p style={{ color: '#6B7280' }}>Управление пользователями системы</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Поиск по имени, username или Telegram ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #D1D5DB',
            fontSize: '16px',
          }}
        />
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

      {/* Users Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E5E7EB',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Пользователь</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Telegram ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Профиль</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#374151' }}>План</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Отзывы</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Дата регистрации</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1F2937' }}>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : user.username || 'Без имени'}
                    </div>
                    {user.username && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>@{user.username}</div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280', fontFamily: 'monospace' }}>
                  {user.telegramId}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {user.hasProfile ? (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#D1FAE5',
                      color: '#065F46',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}>
                      ✓ Есть ({user.profileCount})
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}>
                      Нет
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {user.hasPlan ? (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#DBEAFE',
                      color: '#1E40AF',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}>
                      ✓ Есть ({user.planCount})
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}>
                      Нет
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {user.feedbackCount > 0 ? (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}>
                      {user.feedbackCount}
                    </span>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>0</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
                  {new Date(user.createdAt).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: '#6B7280',
        }}>
          {searchQuery ? 'Пользователи не найдены' : 'Пользователи не найдены'}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '24px',
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: page === 1 ? '#F3F4F6' : 'white',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            ← Назад
          </button>
          <span style={{ padding: '8px 16px' }}>
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: page === totalPages ? '#F3F4F6' : 'white',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.5 : 1,
            }}
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
