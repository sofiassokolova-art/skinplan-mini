// app/admin/layout.tsx
// Layout для админ-панели

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Проверяем, находимся ли мы на странице входа
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Если это страница входа, не проверяем авторизацию
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Проверка авторизации админа
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      
      // Если нет токена, сразу редирект
      if (!token) {
        router.push('/admin/login');
        setLoading(false);
        return;
      }

      // Проверяем токен на сервере
      try {
        const response = await fetch('/api/admin/verify', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include', // Важно: отправляем cookies
        });

        if (!response.ok) {
          console.warn('Token verification failed:', response.status, response.statusText);
          localStorage.removeItem('admin_token');
          setLoading(false);
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        if (data.valid) {
          setIsAuthenticated(true);
          setLoading(false);
        } else {
          localStorage.removeItem('admin_token');
          setLoading(false);
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Token verification error:', error);
        // Если проверка не удалась из-за сетевой ошибки, разрешаем доступ
        // (токен будет проверен при каждом API запросе)
        setIsAuthenticated(true);
        setLoading(false);
      }
    };
    checkAuth();
  }, [router, pathname]); // Добавляем pathname в зависимости, чтобы проверка происходила при смене страницы

  // На странице входа показываем children без проверки авторизации
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">SkinIQ Admin</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <a
                  href="/admin"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Дашборд
                </a>
                <a
                  href="/admin/products"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Продукты
                </a>
                <a
                  href="/admin/rules"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Правила
                </a>
                <a
                  href="/admin/users"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Пользователи
                </a>
                <a
                  href="/admin/feedback"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Отзывы
                </a>
                <a
                  href="/admin/replacements"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Замены
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => {
                  localStorage.removeItem('admin_token');
                  router.push('/admin/login');
                }}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

