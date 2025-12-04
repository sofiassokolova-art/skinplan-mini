// app/admin/users/page.tsx
// Страница управления пользователями с TanStack Table

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { Search, User, Check, X, Calendar, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
  createdAt: string;
  hasProfile: boolean;
  hasPlan: boolean;
  profileCount: number;
  planCount: number;
  feedbackCount: number;
}

export default function UsersAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<any | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Обработка параметра userId из URL
  useEffect(() => {
    const userIdFromUrl = searchParams.get('userId');
    if (userIdFromUrl && !loading && users.length > 0) {
      // Ищем пользователя в текущем списке
      const user = users.find(u => u.id === userIdFromUrl);
      if (user) {
        // Если пользователь найден, открываем его план
        handleViewPlan(userIdFromUrl);
      } else {
        // Если пользователь не найден в текущем списке, 
        // попробуем открыть план напрямую (может быть на другой странице)
        handleViewPlan(userIdFromUrl);
      }
      // Убираем параметр из URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('userId');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams, users, loading]);

  useEffect(() => {
    loadUsers();
  }, [pagination.pageIndex]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `/api/admin/users?page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}`,
        {
        headers: {
          'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        }
      );

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки пользователей');
      }

      const data = await response.json();
      setUsers(data.users || []);
      // TODO: Сохранить total для пагинации
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей:', err);
      setError(err.message || 'Ошибка загрузки пользователей');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };


  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'telegramId',
        header: 'Telegram ID',
        cell: ({ row }) => {
          const telegramId = row.getValue('telegramId') as string;
          return (
            <span className="font-mono text-gray-700 text-sm">{telegramId}</span>
          );
        },
      },
      {
        accessorKey: 'firstName',
        header: 'Пользователь',
        cell: ({ row }) => {
          const user = row.original;
          const name = user.firstName || user.lastName
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
            : user.username || 'Без имени';
          return (
            <div>
              <div className="font-medium text-gray-900">{name}</div>
              {user.username && (
                <div className="text-sm text-gray-600">@{user.username}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'hasProfile',
        header: 'Профиль',
        cell: ({ row }) => {
          const hasProfile = row.getValue('hasProfile') as boolean;
          const profileCount = row.original.profileCount;
          return (
            <div className="flex items-center gap-2">
              {hasProfile ? (
                <>
                  <Check className="text-green-600" size={16} />
                  <span className="text-green-600 text-sm">Есть ({profileCount})</span>
                </>
              ) : (
                <>
                  <X className="text-gray-400" size={16} />
                  <span className="text-gray-400 text-sm">Нет</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'hasPlan',
        header: 'План',
        cell: ({ row }) => {
          const hasPlan = row.getValue('hasPlan') as boolean;
          const planCount = row.original.planCount;
          return (
            <div className="flex items-center gap-2">
              {hasPlan ? (
                <>
                  <Check className="text-blue-600" size={16} />
                  <span className="text-blue-600 text-sm">Есть ({planCount})</span>
                </>
              ) : (
                <>
                  <X className="text-gray-400" size={16} />
                  <span className="text-gray-400 text-sm">Нет</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'feedbackCount',
        header: 'Отзывы',
        cell: ({ row }) => {
          const count = row.getValue('feedbackCount') as number;
          return (
            <span className={cn(
              'px-2 py-1 rounded text-sm',
              count > 0 ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400'
            )}>
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Дата регистрации',
        cell: ({ row }) => {
          const date = new Date(row.getValue('createdAt'));
          return (
            <span className="text-gray-700 text-sm">
              {date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => {
          const user = row.original;
    return (
            <button
              onClick={() => handleViewPlan(user.id)}
              disabled={!user.hasProfile}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                user.hasProfile
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <Eye size={16} />
              План
            </button>
          );
        },
      },
    ],
    []
  );

  const handleViewPlan = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingPlan(true);
    setUserPlan(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/users/${userId}/plan`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUserPlan(data.plan);
      } else {
        const error = await response.json();
        const errorMessage = error.error || 'Не удалось загрузить план';
        // Если план не найден, это не критическая ошибка - просто закрываем модальное окно
        if (response.status === 404 && errorMessage.includes('not found')) {
          alert('План пользователя не найден. Возможно, пользователь еще не сгенерировал план ухода.');
        } else {
          alert(errorMessage);
        }
        // Не закрываем модальное окно сразу, чтобы пользователь мог увидеть информацию
      }
    } catch (err: any) {
      console.error('Error loading plan:', err);
      alert('Ошибка загрузки плана: ' + err.message);
      setSelectedUserId(null);
    } finally {
      setLoadingPlan(false);
    }
  };

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    manualPagination: true, // Серверная пагинация
    pageCount: -1, // Неизвестно количество страниц
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Пользователи</h1>
          <p className="text-gray-600">
            Всего: {table.getFilteredRowModel().rows.length}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Поиск */}
      <div className="bg-transparent rounded-2xl border border-gray-200 shadow-sm p-4 mb-12">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-300">
            <div className="flex items-center justify-center px-4 py-2 bg-white">
              <Search className="text-gray-500" size={18} />
            </div>
            <input
              type="text"
              placeholder="Поиск по имени, username или Telegram ID..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="flex-1 pl-8 pr-4 py-2 bg-white text-gray-900 placeholder-gray-400 focus:outline-none border-0"
            />
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-transparent rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-2',
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-900'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
            </tr>
              ))}
          </thead>
          <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-600">
                    Пользователи не найдены
                </td>
              </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
          </tbody>
        </table>
      </div>

        {/* Пагинация */}
        <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between bg-transparent">
          <div className="text-gray-600 text-sm">
            Страница {pagination.pageIndex + 1}
        </div>
          <div className="flex items-center gap-2">
          <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Назад
          </button>
          <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
              Вперед
          </button>
          </div>
        </div>
      </div>

      {/* Модальное окно просмотра плана */}
      {selectedUserId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-auto shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">План пользователя</h2>
              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setUserPlan(null);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            {loadingPlan ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-600">Загрузка плана...</div>
              </div>
            ) : userPlan ? (
              <div className="space-y-6">
                {/* Информация о профиле */}
                {userPlan.profile && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Профиль кожи</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Тип кожи:</span>
                        <div className="font-medium text-gray-900">{userPlan.profile.skinType || 'Не указан'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Основной фокус:</span>
                        <div className="font-medium text-gray-900">{userPlan.profile.primaryFocus || 'Не указан'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Возраст:</span>
                        <div className="font-medium text-gray-900">{userPlan.profile.ageGroup || 'Не указан'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Проблемы:</span>
                        <div className="font-medium text-gray-900">
                          {userPlan.profile.concerns?.length > 0 
                            ? userPlan.profile.concerns.join(', ') 
                            : 'Не указаны'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Список продуктов */}
                {userPlan.products && userPlan.products.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Средства в плане ({userPlan.products.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userPlan.products.map((product: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-start gap-4">
                            {product.imageUrl && (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-20 h-20 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 mb-1">{product.name}</div>
                              <div className="text-sm text-gray-600 mb-2">{product.brand}</div>
                              <div className="text-xs text-gray-500 mb-2">
                                {product.category} • {product.price ? `${product.price} ₽` : 'Цена не указана'}
                              </div>
                              {product.ingredients && product.ingredients.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  <span className="font-medium">Активные ингредиенты:</span> {product.ingredients.slice(0, 3).join(', ')}
                                  {product.ingredients.length > 3 && '...'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Предупреждения */}
                {userPlan.warnings && userPlan.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-yellow-900 mb-2">Предупреждения</h3>
                    <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                      {userPlan.warnings.map((warning: string, idx: number) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Недели плана (если есть) */}
                {userPlan.weeks && userPlan.weeks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Расписание по неделям</h3>
                    <div className="space-y-4">
                      {userPlan.weeks.map((week: any, weekIdx: number) => (
                        <div key={weekIdx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="font-bold text-gray-900 mb-2">Неделя {week.week}</div>
                          {week.summary && (
                            <div className="text-sm text-gray-600 mb-3">
                              Фокус: {week.summary.focus?.join(', ') || 'Не указан'}
                            </div>
                          )}
                          {week.days && week.days.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Дней в плане: {week.days.length}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-600">План не найден</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
