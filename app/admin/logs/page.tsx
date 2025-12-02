// app/admin/logs/page.tsx
// Страница для просмотра логов клиентов

'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Trash2, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';

interface ClientLog {
  id: string;
  userId: string;
  level: string;
  message: string;
  context: any;
  userAgent: string | null;
  url: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ClientLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    userId: '',
    level: '',
    limit: 100,
    offset: 0,
  });
  const [searchUserId, setSearchUserId] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.level) params.append('level', filters.level);
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        console.error('Failed to fetch logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const handleDeleteOld = async (days: number) => {
    if (!confirm(`Удалить все логи старше ${days} дней?`)) return;

    try {
      const response = await fetch(`/api/admin/logs?days=${days}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('Старые логи удалены');
        fetchLogs();
      } else {
        alert('Ошибка при удалении логов');
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      alert('Ошибка при удалении логов');
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'debug':
        return <Bug className="w-4 h-4 text-gray-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warn':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'debug':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Логи клиентов</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleDeleteOld(7)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Удалить старше 7 дней
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="Введите User ID"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                onClick={() => setFilters({ ...filters, userId: searchUserId, offset: 0 })}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Уровень
            </label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value, offset: 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Все</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Лимит
            </label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), offset: 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ userId: '', level: '', limit: 100, offset: 0 });
                setSearchUserId('');
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="text-sm text-gray-600">
          Всего логов: <span className="font-semibold text-gray-900">{total}</span>
          {filters.userId && (
            <>
              {' | '}
              Фильтр по User ID: <span className="font-semibold text-gray-900">{filters.userId}</span>
            </>
          )}
          {filters.level && (
            <>
              {' | '}
              Уровень: <span className="font-semibold text-gray-900">{filters.level}</span>
            </>
          )}
        </div>
      </div>

      {/* Список логов */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Логи не найдены</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`bg-white rounded-xl p-4 shadow-sm border ${getLevelColor(log.level)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getLevelIcon(log.level)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm uppercase">{log.level}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {log.user.firstName} {log.user.lastName} (@{log.user.username || 'нет username'})
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      User ID: {log.userId} | Telegram ID: {log.user.telegramId}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="font-medium text-sm mb-2">Сообщение:</div>
                <div className="text-sm bg-white/50 rounded p-2 border border-gray-200">
                  {log.message}
                </div>
              </div>

              {log.url && (
                <div className="mt-2 text-xs text-gray-600">
                  URL: <span className="font-mono">{log.url}</span>
                </div>
              )}

              {log.context && Object.keys(log.context).length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Контекст (нажмите для просмотра)
                  </summary>
                  <pre className="mt-2 text-xs bg-white/50 rounded p-2 border border-gray-200 overflow-auto max-h-64">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                </details>
              )}

              {log.userAgent && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    User Agent
                  </summary>
                  <div className="mt-1 text-xs text-gray-600 font-mono bg-white/50 rounded p-2 border border-gray-200">
                    {log.userAgent}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {total > filters.limit && (
        <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">
            Показано {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} из {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
              disabled={filters.offset === 0}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <button
              onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
              disabled={filters.offset + filters.limit >= total}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперед
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

