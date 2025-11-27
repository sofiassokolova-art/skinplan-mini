// app/admin/layout.tsx
// Layout для админ-панели в премиальном SaaS-стиле 2025

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
  User
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
  const [adminInfo, setAdminInfo] = useState<{ telegramId?: string; role?: string } | null>(null);

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
            setAdminInfo(data.admin || {});
          } else {
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
    { href: '/admin/broadcast', label: 'Рассылки', icon: Send },
  ];

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-[#64748b]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      {/* Sidebar - 280px фиксированная ширина */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-10 flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'
        )}
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '2px 0 24px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Логотип и название */}
        <div className="p-6 border-b border-[#e2e8f0] flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center text-white font-bold text-lg">
            SQ
          </div>
          <div>
            <div className="font-bold text-[#1e1e1e] text-lg">SkinIQ</div>
            <div className="text-xs text-[#64748b]">Admin Panel</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-[#64748b] hover:text-[#1e1e1e] hover:bg-[#f8f9fa] rounded-lg p-1.5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Навигация */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
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
                      ? 'bg-[#f5f3ff] text-[#8b5cf6] font-semibold'
                      : 'text-[#64748b] hover:text-[#1e1e1e] hover:bg-[#f8f9fa]'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#8b5cf6] rounded-r-full" />
                  )}
                  <Icon size={20} className={isActive ? 'text-[#8b5cf6]' : ''} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Аватар админа */}
        <div className="p-4 border-t border-[#e2e8f0] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center text-white font-semibold">
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#1e1e1e] text-sm truncate">Администратор</div>
              <div className="text-xs text-[#64748b] truncate">{adminInfo?.telegramId || 'Admin'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Кнопка открытия меню (когда закрыто) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-20 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-[#64748b] hover:text-[#1e1e1e] transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Main Content - отступ слева 280px */}
      <main className={cn(
        'flex-1 overflow-auto bg-[#f8f9fa] transition-all duration-300',
        sidebarOpen ? 'ml-[280px]' : 'ml-0'
      )}>
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
