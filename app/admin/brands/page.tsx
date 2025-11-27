// app/admin/brands/page.tsx
// Страница управления брендами

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { cn, glassCard, glassCardHover } from '@/lib/utils';

interface Brand {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string;
  country?: string;
  isActive: boolean;
}

export default function BrandsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-4xl font-bold text-white mb-2">Бренды</h1>
          <p className="text-white/60">Всего: {brands.length}</p>
        </div>
        <button
          className={cn(
            'px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-2xl font-bold',
            'hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all duration-300',
            'flex items-center gap-2'
          )}
        >
          <Plus size={20} />
          Добавить бренд
        </button>
      </div>

      {error && (
        <div className={cn(glassCard, 'p-4 bg-red-500/20 border-red-500/50')}>
          <p className="text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className={cn(glassCard, glassCardHover, 'p-6')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{brand.name}</h3>
                {brand.country && (
                  <p className="text-white/60 text-sm">{brand.country}</p>
                )}
              </div>
              {brand.isActive ? (
                <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                  Активен
                </span>
              ) : (
                <span className="px-2 py-1 bg-white/10 text-white/40 rounded text-xs">
                  Неактивен
                </span>
              )}
            </div>
            {brand.logoUrl && (
              <div className="mb-4">
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-16 object-contain"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                <Edit className="text-white/80" size={16} />
              </button>
              <button className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors">
                <Trash2 className="text-red-400" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

