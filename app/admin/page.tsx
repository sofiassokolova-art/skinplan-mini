// app/admin/page.tsx
// Главная страница админ-панели (дашборд)

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    questionnaires: 0,
    rules: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем статистику
    const loadStats = async () => {
      try {
        // TODO: Добавить API для статистики
        setStats({
          users: 0,
          products: 5,
          questionnaires: 1,
          rules: 4,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <p className="mt-2 text-sm text-gray-600">
          Управление продуктами, анкетой и правилами рекомендаций
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">U</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Пользователи
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.users}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">P</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Продукты
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.products}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">Q</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Анкеты
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.questionnaires}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Правила
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.rules}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/products"
          className="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Управление продуктами
            </h3>
            <p className="text-sm text-gray-500">
              Добавление, редактирование и удаление продуктов
            </p>
          </div>
        </Link>

        <Link
          href="/admin/questionnaire"
          className="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Управление анкетой
            </h3>
            <p className="text-sm text-gray-500">
              Редактирование вопросов и вариантов ответов
            </p>
          </div>
        </Link>

        <Link
          href="/admin/rules"
          className="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Правила рекомендаций
            </h3>
            <p className="text-sm text-gray-500">
              Настройка правил подбора продуктов
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

