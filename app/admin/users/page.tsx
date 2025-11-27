// app/admin/users/page.tsx
// Страница управления пользователями с TanStack Table

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Search, User, Check, X } from 'lucide-react';
import { cn, glassCard } from '@/lib/utils';

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
            <span className="font-mono text-white/80 text-sm">{telegramId}</span>
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
              <div className="font-medium text-white">{name}</div>
              {user.username && (
                <div className="text-sm text-white/60">@{user.username}</div>
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
                  <Check className="text-green-400" size={16} />
                  <span className="text-green-400 text-sm">Есть ({profileCount})</span>
                </>
              ) : (
                <>
                  <X className="text-white/40" size={16} />
                  <span className="text-white/40 text-sm">Нет</span>
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
                  <Check className="text-blue-400" size={16} />
                  <span className="text-blue-400 text-sm">Есть ({planCount})</span>
                </>
              ) : (
                <>
                  <X className="text-white/40" size={16} />
                  <span className="text-white/40 text-sm">Нет</span>
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
              count > 0 ? 'bg-yellow-500/20 text-yellow-300' : 'text-white/40'
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
            <span className="text-white/80 text-sm">
              {date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
    ],
    []
  );

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
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Пользователи</h1>
          <p className="text-white/60">
            Всего: {table.getFilteredRowModel().rows.length}
          </p>
        </div>
      </div>

      {error && (
        <div className={cn(glassCard, 'p-4 bg-red-500/20 border-red-500/50')}>
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Поиск */}
      <div className={cn(glassCard, 'p-4')}>
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={20} />
            <input
              type="text"
              placeholder="Поиск по имени, username или Telegram ID..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full pl-12 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
            />
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className={cn(glassCard, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-medium text-white/80"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-2',
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-white'
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
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-white/60">
                    Пользователи не найдены
                </td>
              </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
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
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-white/60 text-sm">
            Страница {pagination.pageIndex + 1}
        </div>
          <div className="flex items-center gap-2">
          <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Назад
          </button>
          <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
              Вперед
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
