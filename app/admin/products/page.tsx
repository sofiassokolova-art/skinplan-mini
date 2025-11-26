// app/admin/products/page.tsx
// Страница управления продуктами в админке

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  slug?: string;
  price?: number;
  volume?: string;
  descriptionUser?: string;
  imageUrl?: string;
  step: string;
  category: string;
  skinTypes: string[];
  concerns: string[];
  activeIngredients: string[];
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/products', {
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
        throw new Error('Ошибка загрузки продуктов');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
      console.error('Ошибка загрузки продуктов:', err);
      setError(err.message || 'Ошибка загрузки продуктов');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.brand.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
            Продукты ({filteredProducts.length})
          </h1>
          <p style={{ color: '#6B7280' }}>Управление каталогом продуктов</p>
        </div>
        <Link
          href="/admin/products/new"
          style={{
            backgroundColor: '#9333EA',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          + Добавить продукт
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Поиск по названию, бренду или категории..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #D1D5DB',
            fontSize: '16px',
          }}
        />
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Products Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
      }}>
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
            }}
          >
            {/* Image */}
            <div style={{
              width: '100%',
              height: '192px',
              backgroundColor: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{ color: '#9CA3AF', fontSize: '48px' }}>🖼️</div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>
              <div style={{
                fontSize: '12px',
                color: '#9333EA',
                fontWeight: '600',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}>
                {product.brand.name}
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '8px',
                color: '#1F2937',
              }}>
                {product.name}
              </h3>
              
              {product.price && (
                <p style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#9333EA',
                  marginBottom: '8px',
                }}>
                  {product.price} ₽
                </p>
              )}

              {/* Tags */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '16px',
              }}>
                {product.skinTypes.slice(0, 3).map((type) => (
                  <span
                    key={type}
                    style={{
                      fontSize: '12px',
                      backgroundColor: '#EEF2FF',
                      color: '#4338CA',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {type}
                  </span>
                ))}
                {product.isHero && (
                  <span
                    style={{
                      fontSize: '12px',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '600',
                    }}
                  >
                    ⭐ Hero
                  </span>
                )}
                {!product.published && (
                  <span
                    style={{
                      fontSize: '12px',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      padding: '4px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    Черновик
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  href={`/admin/products/${product.id}`}
                  style={{
                    flex: 1,
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    textAlign: 'center',
                    padding: '8px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Редактировать
                </Link>
                <button
                  onClick={async () => {
                    if (!confirm('Вы уверены, что хотите удалить этот продукт?')) return;
                    
                    try {
                      const token = localStorage.getItem('admin_token');
                      const response = await fetch(`/api/admin/products/${product.id}`, {
                        method: 'DELETE',
                        headers: {
                          ...(token && { Authorization: `Bearer ${token}` }),
                        },
                        credentials: 'include',
                      });
                      
                      if (response.ok) {
                        await loadProducts();
                      } else {
                        alert('Ошибка удаления продукта');
                      }
                    } catch (err) {
                      console.error('Ошибка удаления:', err);
                      alert('Ошибка удаления продукта');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#EF4444',
                    color: 'white',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: '#6B7280',
        }}>
          {searchQuery ? 'Продукты не найдены' : 'Продукты не добавлены'}
        </div>
      )}
    </div>
  );
}
