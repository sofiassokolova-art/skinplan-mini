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
  X,
  FileSearch,
  TrendingUp
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
  const [isMobile, setIsMobile] = useState(false);

  // Проверяем размер экрана и адаптируем сайдбар
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
      if (window.innerWidth < 1024) {
        setSidebarOpen(false); // На мобильных по умолчанию закрыт
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    let mounted = true;

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/auth', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });

        if (!mounted) return;

        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [pathname, isLoginPage]);

  // ИСПРАВЛЕНО: Все хуки должны быть вызваны ДО любых условных return'ов
  // Это критично для соблюдения правил React Hooks (React error #310)
  
  // Хук 2: Редирект при отсутствии авторизации
  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      console.log('[AdminLayout] Not authenticated, redirecting to login', { pathname, loading, isAuthenticated });
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, isLoginPage, router, pathname]);
  
  // Хук 3: Отладочное логирование
  // ИСПРАВЛЕНО: Убрали children из зависимостей для стабильности
  useEffect(() => {
    console.log('[AdminLayout] State update', { 
      pathname, 
      loading, 
      isAuthenticated, 
      isLoginPage,
      hasChildren: !!children 
    });
  }, [pathname, loading, isAuthenticated, isLoginPage]);

  const menuItems = [
    { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Пользователи', icon: Users },
    { href: '/admin/products', label: 'Продукты', icon: Package },
    { href: '/admin/brands', label: 'Бренды', icon: Package },
    { href: '/admin/rules', label: 'Правила', icon: FileText },
    { href: '/admin/feedback', label: 'Отзывы', icon: MessageSquare },
    { href: '/admin/support', label: 'Поддержка', icon: MessageSquare },
    { href: '/admin/broadcasts', label: 'Рассылки', icon: Send },
    { href: '/admin/funnel', label: 'Воронка конверсии', icon: TrendingUp },
    { href: '/admin/logs', label: 'Логи клиентов', icon: FileSearch },
  ];

  // Условные return'ы ПОСЛЕ всех хуков
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
  
  // Если не авторизован и не на странице логина, показываем сообщение
  if (!loading && !isAuthenticated && !isLoginPage) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Перенаправление на страницу входа...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen admin-layout relative" style={{ 
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 30%, #f9fafb 60%, #f3f4f6 100%)',
      backgroundSize: '400% 400%'
    }}>
      <style jsx global>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .admin-layout {
          animation: gradientShift 15s ease infinite;
        }
      `}</style>
      
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Glassmorphism */}
      <aside
        className={cn(
          'admin-sidebar-glass transition-all duration-300 fixed left-0 top-0 bottom-0 z-50 flex flex-col',
          sidebarOpen ? 'w-72' : 'w-20',
          isMobile && !sidebarOpen && '-translate-x-full lg:translate-x-0'
        )}
        style={{ 
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.06)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200/30 flex items-center justify-between flex-shrink-0">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              SkinIQ Admin
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-lg p-2 transition-all duration-200 backdrop-blur-sm flex-shrink-0"
            aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group',
                  isActive
                    ? 'bg-white/80 text-gray-900 shadow-md shadow-black/5 backdrop-blur-sm'
                    : 'text-gray-700 hover:bg-white/50 hover:text-gray-900 hover:backdrop-blur-sm'
                )}
                style={{ minHeight: '44px' }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gray-900 rounded-r-full" />
                )}
                <Icon size={20} className="flex-shrink-0" style={{ width: '20px', height: '20px', minWidth: '20px', flexShrink: 0 }} />
                {sidebarOpen && (
                  <span className={cn(
                    'font-medium transition-opacity',
                    sidebarOpen ? 'opacity-100' : 'opacity-0'
                  )}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile menu button */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-gray-200/50 hover:bg-white transition-colors lg:hidden"
          aria-label="Открыть меню"
        >
          <Menu size={20} className="text-gray-700" />
        </button>
      )}

      {/* Main Content Area */}
      <main 
        className={cn(
          'min-h-screen transition-all duration-300',
          isMobile 
            ? 'ml-0 px-4 py-6' 
            : sidebarOpen 
              ? 'ml-72 px-8 py-8' 
              : 'ml-20 px-8 py-8'
        )}
      >
        <div className="max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
