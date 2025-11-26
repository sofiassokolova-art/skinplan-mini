// components/MetricsDashboard.tsx
// Дашборд метрик для админ-панели

'use client';

import { useState } from 'react';

interface MetricsStats {
  users: number;
  products: number;
  plans: number;
  badFeedback: number;
  replacements: number;
  churnRate: number;
  avgLTV: number;
  topProducts: Array<{
    id: number;
    name: string;
    brand: string;
    wishlistCount: number;
    feedbackCount: number;
    avgRating: number;
  }>;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  totalWishlistItems: number;
  totalProductFeedback: number;
  avgFeedbackRating: number;
}

interface MetricsDashboardProps {
  data: MetricsStats;
}

/**
 * Экспорт метрик в CSV
 */
function exportToCSV(data: MetricsStats) {
  const csvRows: string[] = [];
  
  // Заголовки
  csvRows.push('Метрика,Значение');
  
  // Основные метрики
  csvRows.push(`Всего пользователей,${data.users}`);
  csvRows.push(`Новых за 7 дней,${data.newUsersLast7Days}`);
  csvRows.push(`Новых за 30 дней,${data.newUsersLast30Days}`);
  csvRows.push(`Активных за 7 дней,${data.activeUsersLast7Days}`);
  csvRows.push(`Активных за 30 дней,${data.activeUsersLast30Days}`);
  csvRows.push(`Churn Rate,${data.churnRate}%`);
  csvRows.push(`Средний LTV,${data.avgLTV.toLocaleString()} ₽`);
  csvRows.push(`Всего продуктов,${data.products}`);
  csvRows.push(`Активных планов,${data.plans}`);
  csvRows.push(`Плохих отзывов,${data.badFeedback}`);
  csvRows.push(`Замен продуктов,${data.replacements}`);
  csvRows.push(`Всего в избранном,${data.totalWishlistItems}`);
  csvRows.push(`Всего отзывов,${data.totalProductFeedback}`);
  csvRows.push(`Средний рейтинг,${data.avgFeedbackRating}`);
  
  // Топ продуктов
  csvRows.push('');
  csvRows.push('Топ продуктов');
  csvRows.push('Название,Бренд,В избранном,Отзывов');
  data.topProducts.forEach((product) => {
    csvRows.push(`"${product.name}","${product.brand}",${product.wishlistCount},${product.feedbackCount}`);
  });
  
  // Создаем и скачиваем файл
  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM для Excel
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `skinplan-metrics-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function MetricsDashboard({ data }: MetricsDashboardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    window.location.reload();
  };

  const handleExport = () => {
    exportToCSV(data);
  };

  // Вычисляем процент роста пользователей
  const userGrowth7d = data.newUsersLast7Days > 0
    ? Math.round((data.newUsersLast7Days / data.activeUsersLast7Days) * 100)
    : 0;

  // Retention rate (обратный churn)
  const retentionRate = 100 - data.churnRate;

  return (
    <div className="space-y-6">
      {/* Заголовок с действиями */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Дашборд метрик</h2>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {refreshing ? 'Обновление...' : '🔄 Обновить'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
          >
            📥 Экспорт CSV
          </button>
        </div>
      </div>

      {/* Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Churn Rate */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="text-3xl font-bold mb-2">{data.churnRate}%</div>
          <div className="text-red-100 text-sm mb-1">Churn Rate</div>
          <div className="text-red-200 text-xs">Отток пользователей</div>
        </div>

        {/* Retention Rate */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="text-3xl font-bold mb-2">{retentionRate}%</div>
          <div className="text-emerald-100 text-sm mb-1">Retention Rate</div>
          <div className="text-emerald-200 text-xs">Удержание пользователей</div>
        </div>

        {/* Средний LTV */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="text-3xl font-bold mb-2">{data.avgLTV.toLocaleString()} ₽</div>
          <div className="text-purple-100 text-sm mb-1">Средний LTV</div>
          <div className="text-purple-200 text-xs">Пожизненная ценность</div>
        </div>

        {/* Новые пользователи за 7 дней */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="text-3xl font-bold mb-2">+{data.newUsersLast7Days}</div>
          <div className="text-blue-100 text-sm mb-1">Новых за 7 дней</div>
          <div className="text-blue-200 text-xs">Рост: {userGrowth7d}%</div>
        </div>
      </div>

      {/* Временные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{data.newUsersLast7Days}</div>
          <div className="text-gray-600 text-sm mt-1">Новых за 7 дней</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{data.newUsersLast30Days}</div>
          <div className="text-gray-600 text-sm mt-1">Новых за 30 дней</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{data.activeUsersLast7Days}</div>
          <div className="text-gray-600 text-sm mt-1">Активных за 7 дней</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <div className="text-2xl font-bold text-gray-900">{data.activeUsersLast30Days}</div>
          <div className="text-gray-600 text-sm mt-1">Активных за 30 дней</div>
        </div>
      </div>

      {/* Продуктовые метрики */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4">Продуктовые метрики</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.totalWishlistItems}</div>
            <div className="text-gray-600 text-sm">В избранном</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.totalProductFeedback}</div>
            <div className="text-gray-600 text-sm">Отзывов</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.avgFeedbackRating.toFixed(1)}</div>
            <div className="text-gray-600 text-sm">Средний рейтинг</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{data.badFeedback}</div>
            <div className="text-gray-600 text-sm">Плохих отзывов</div>
          </div>
        </div>
      </div>

      {/* Топ продуктов */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4">Топ продуктов по популярности</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Продукт</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">В избранном</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Отзывов</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Рейтинг</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Нет данных о продуктах
                  </td>
                </tr>
              ) : (
                data.topProducts.map((product, index) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.brand}</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full font-bold">
                        {product.wishlistCount}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-bold">
                        {product.feedbackCount}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-medium">{product.avgRating.toFixed(1) || '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

