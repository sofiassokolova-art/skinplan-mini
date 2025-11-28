// app/admin/brands/page.tsx
// Страница управления брендами (таблица как продукты)

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
import { Search, Eye, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Brand {
  id: number;
  name: string;
  slug?: string;
  isActive?: boolean;
  productCount?: number;
}

export default function BrandsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/brands', {
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
        throw new Error('Ошибка загрузки брендов');
      }

      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err: any) {
      console.error('Ошибка загрузки брендов:', err);
      setError(err.message || 'Ошибка загрузки брендов');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: number, newActive: boolean) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/brands/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: newActive }),
      });

      if (response.ok) {
        await loadBrands();
      } else {
        alert('Ошибка обновления бренда');
      }
    } catch (err) {
      console.error('Ошибка обновления бренда:', err);
      alert('Ошибка обновления бренда');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите деактивировать этот бренд? Все его продукты перестанут показываться в рекомендациях.')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/brands/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.ok) {
        await loadBrands();
      } else {
        alert('Ошибка удаления бренда');
      }
    } catch (err) {
      console.error('Ошибка удаления бренда:', err);
      alert('Ошибка удаления бренда');
    }
  };

  const columns = useMemo<ColumnDef<Brand>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Название',
        cell: ({ row }) => {
          const brand = row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">{brand.name}</div>
              {brand.slug && (
                <div className="text-sm text-gray-500">{brand.slug}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'productCount',
        header: 'Продуктов',
        cell: ({ row }) => {
          const count = row.getValue('productCount') as number | undefined;
          return (
            <span className="text-gray-700 font-medium">
              {count || 0}
            </span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Статус',
        cell: ({ row }) => {
          const isActive = row.getValue('isActive') as boolean | undefined;
          return (
            <div className="flex items-center gap-2">
              {isActive ? (
                <>
                  <Eye className="text-green-600" size={16} />
                  <span className="text-green-600 text-sm">Активен</span>
                </>
              ) : (
                <>
                  <EyeOff className="text-gray-400" size={16} />
                  <span className="text-gray-400 text-sm">Неактивен</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => {
          const brand = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(brand.id, !brand.isActive)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title={brand.isActive ? 'Деактивировать' : 'Активировать'}
              >
                {brand.isActive ? (
                  <EyeOff className="text-gray-700" size={16} />
                ) : (
                  <Eye className="text-gray-700" size={16} />
                )}
              </button>
              <button
                onClick={() => handleDelete(brand.id)}
                className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                title="Удалить (деактивировать)"
              >
                <Trash2 className="text-red-600" size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: brands,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Бренды</h1>
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
      <div className="bg-transparent rounded-2xl p-4 shadow-sm border border-gray-200 mb-12">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-300">
            <div className="flex items-center justify-center px-4 py-2 bg-white">
              <Search className="text-gray-500" size={18} />
            </div>
            <input
              type="text"
              placeholder="Поиск по названию бренда..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="flex-1 pl-8 pr-4 py-2 bg-white text-gray-900 placeholder-gray-400 focus:outline-none border-0"
            />
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-transparent rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    Бренды не найдены
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
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
        <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-gray-600 text-sm">
            Страница {table.getState().pagination.pageIndex + 1} из {table.getPageCount()}
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
    </div>
  );
}
