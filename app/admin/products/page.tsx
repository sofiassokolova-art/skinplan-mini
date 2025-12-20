// app/admin/products/page.tsx
// Страница управления продуктами с TanStack Table

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Search, Plus, Edit, Trash2, Eye, EyeOff, Download, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  slug?: string;
  price?: number;
  volume?: string;
  description?: string;
  composition?: string;
  link?: string;
  imageUrl?: string;
  step: string;
  category: string;
  skinTypes: string[];
  concerns: string[];
  activeIngredients: string[];
  avoidIf: string[];
  published: boolean;
  isHero: boolean;
  priority: number;
  brand: {
    id: number;
    name: string;
  };
}

export default function ProductsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch('/api/admin/products', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка загрузки продуктов (${response.status})`);
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      console.error('Ошибка загрузки продуктов:', err);
      setError(err.message || 'Ошибка загрузки продуктов');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    // ИСПРАВЛЕНО (P1): Улучшен текст подтверждения удаления
    if (!confirm('Продукт будет удалён из базы и перестанет участвовать в рекомендациях. Продолжить?')) return;
    
    try {
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }
      
      if (response.ok) {
        await loadProducts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Ошибка удаления продукта');
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
      alert('Ошибка удаления продукта');
    }
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setShowExportMenu(false);
      setExportLoading(true);
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      
      // Отправляем запрос на экспорт в Telegram
      const response = await fetch('/api/admin/products/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ format }),
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка экспорта');
      }

      const data = await response.json();
      alert(`✅ ${data.message || 'Файл успешно отправлен в Telegram!'}`);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      alert('❌ Ошибка экспорта: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    } finally {
      setExportLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'imageUrl',
        header: 'Фото',
        cell: ({ row }) => {
          const imageUrl = row.getValue('imageUrl') as string | undefined;
          return (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              {imageUrl ? (
                // ИСПРАВЛЕНО (P2): Lazy loading для производительности
                <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  Нет фото
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'name',
        header: 'Название',
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">{product.name}</div>
              <div className="text-sm text-gray-600">{product.brand.name}</div>
            </div>
          );
        },
      },
      {
        accessorKey: 'price',
        header: 'Цена',
        cell: ({ row }) => {
          const price = row.getValue('price') as number | undefined;
          return price ? (
            <span className="text-gray-900 font-medium">{price.toLocaleString()} ₽</span>
          ) : (
            <span className="text-gray-400">—</span>
          );
        },
      },
      {
        accessorKey: 'step',
        header: 'Шаг',
        cell: ({ row }) => {
          const step = row.getValue('step') as string;
          const stepLabels: Record<string, string> = {
            cleanser: 'Очищение',
            toner: 'Тонер',
            serum: 'Сыворотка',
            moisturizer: 'Увлажнение',
            spf: 'SPF',
            treatment: 'Лечение',
            mask: 'Маска',
          };
          return (
            <span className="text-gray-700 text-sm">{stepLabels[step] || step}</span>
          );
        },
      },
      {
        accessorKey: 'skinTypes',
        header: 'Типы кожи',
        cell: ({ row }) => {
          const skinTypes = row.getValue('skinTypes') as string[];
          return (
            <div className="flex flex-wrap gap-1">
              {skinTypes.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                >
                  {type}
                </span>
              ))}
              {skinTypes.length > 2 && (
                <span className="text-gray-500 text-xs">+{skinTypes.length - 2}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'published',
        header: 'Статус',
        cell: ({ row }) => {
          const published = row.getValue('published') as boolean;
          return (
            <div className="flex items-center gap-2">
              {published ? (
                <>
                  <Eye className="text-green-600" size={16} />
                  <span className="text-green-600 text-sm">Опубликован</span>
                </>
              ) : (
                <>
                  <EyeOff className="text-gray-400" size={16} />
                  <span className="text-gray-400 text-sm">Черновик</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: 'Приоритет',
        cell: ({ row }) => {
          const priority = row.getValue('priority') as number;
          const isHero = row.original.isHero;
          return (
            <div className="flex items-center gap-2">
              <span className="text-gray-700">{priority}</span>
              {isHero && (
                <span className="px-2 py-1 bg-gray-800 text-white rounded text-xs font-medium">
                  Hero
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Действия',
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/products/${product.id}`}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Edit className="text-gray-700" size={16} />
              </Link>
              <button
                onClick={() => handleDelete(product.id)}
                className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
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

  // ИСПРАВЛЕНО (P1): Кастомный globalFilterFn для поиска по названию, бренду, категории и шагу
  const globalFilterFn = (row: any, columnId: string, filterValue: string) => {
    const product = row.original as Product;
    const searchValue = filterValue.toLowerCase();
    
    // Поиск по названию
    if (product.name?.toLowerCase().includes(searchValue)) return true;
    
    // Поиск по бренду
    if (product.brand?.name?.toLowerCase().includes(searchValue)) return true;
    
    // Поиск по категории
    if (product.category?.toLowerCase().includes(searchValue)) return true;
    
    // Поиск по шагу
    if (product.step?.toLowerCase().includes(searchValue)) return true;
    
    return false;
  };

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn, // ИСПРАВЛЕНО (P1): Используем кастомный фильтр
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Продукты</h1>
          <p className="text-gray-600">
            Всего: {products.length} {table.getFilteredRowModel().rows.length !== products.length && `(отфильтровано: ${table.getFilteredRowModel().rows.length})`}
          </p>
          </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exportLoading} // ИСПРАВЛЕНО (P1): Защита от двойного клика
              className={cn(
                'px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200',
                'transition-all duration-200 flex items-center gap-2',
                exportLoading && 'opacity-50 cursor-not-allowed' // ИСПРАВЛЕНО (P1): Визуальная индикация
              )}
            >
              <Download size={18} />
              {exportLoading ? 'Отправка...' : 'Экспорт'} {/* ИСПРАВЛЕНО (P1): Индикация процесса */}
              <ChevronDown
                size={16}
                className={cn(
                  'transition-transform',
                  showExportMenu && 'transform rotate-180'
                )}
              />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exportLoading}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors rounded-t-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? '⏳ Отправка...' : '📊 Экспорт в CSV'}
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exportLoading}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors rounded-b-lg border-t border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? '⏳ Отправка...' : '📄 Экспорт в JSON'}
                </button>
              </div>
            )}
          </div>
          <Link
            href="/admin/products/new"
            className={cn(
              'px-6 py-3 bg-black text-white rounded-2xl font-bold hover:bg-gray-800',
              'hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all duration-300',
              'flex items-center gap-2'
            )}
          >
            <Plus size={20} />
            Добавить продукт
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
      </div>
      )}

      {/* Поиск и фильтры */}
      <div className="bg-transparent rounded-2xl border border-gray-200 shadow-sm p-4 mb-12">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-300">
            <div className="flex items-center justify-center px-4 py-2 bg-white">
              <Search className="text-gray-500" size={18} />
            </div>
            <input
              type="text"
              placeholder="Поиск по названию, бренду, категории..."
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
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                    Продукты не найдены
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
