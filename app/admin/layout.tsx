// app/admin/layout.tsx
// Layout для админ-панели с glassmorphism стилем

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Settings, 
  MessageSquare,
  Send,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
      const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/auth', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });

        if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setIsAuthenticated(true);
          } else {
            // Не перенаправляем сразу, даем странице возможность проверить сама
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, isLoginPage]);

  const menuItems = [
    { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Пользователи', icon: Users },
    { href: '/admin/products', label: 'Продукты', icon: Package },
    { href: '/admin/brands', label: 'Бренды', icon: Package },
    { href: '/admin/rules', label: 'Правила', icon: FileText },
    { href: '/admin/feedback', label: 'Отзывы', icon: MessageSquare },
    { href: '/admin/support', label: 'Поддержка', icon: MessageSquare },
    { href: '/admin/broadcasts', label: 'Рассылки', icon: Send },
  ];

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  // Не блокируем рендер, если не авторизован - пусть страница сама решает
  // if (!isAuthenticated) {
  //   return null;
  // }

  return (
    <div className="min-h-screen admin-layout relative" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)' }}>
      {/* Sidebar */}
      <aside
        className={cn(
          'admin-sidebar transition-all duration-300 fixed left-0 top-0 bottom-0 z-10 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
        style={{ 
          backgroundColor: 'rgba(243, 244, 246, 0.95)',
          height: '100vh'
        }}
      >
        <div className="p-6 border-b border-gray-200/50 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: 'transparent' }}>
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              SkinIQ Admin
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 rounded-lg p-2 transition-all duration-200"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
              </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto" style={{ backgroundColor: 'transparent' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-black text-white shadow-lg shadow-black/10'
                    : 'text-gray-700 hover:bg-gray-100/50 hover:text-gray-900'
                )}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main 
        className="overflow-auto min-h-screen pr-6 md:pr-8 pt-8 md:pt-10 pb-6 md:pb-8"
        style={{
          marginLeft: sidebarOpen ? '256px' : '80px',
          width: sidebarOpen ? 'calc(100% - 256px)' : 'calc(100% - 80px)'
        }}
      >
        <div className="max-w-7xl mx-auto w-full bg-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
