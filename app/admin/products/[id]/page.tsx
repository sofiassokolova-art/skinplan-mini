// app/admin/products/[id]/page.tsx
// Страница редактирования продукта

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Brand {
  id: number;
  name: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState({
    name: '',
    brandId: '',
    price: '',
    volume: '',
    description: '',
    descriptionUser: '',
    imageUrl: '',
    step: '',
    skinTypes: [] as string[],
    concerns: [] as string[],
    activeIngredients: '',
    avoidIf: [] as string[],
    isHero: false,
    priority: 50,
    published: true,
  });

  useEffect(() => {
    loadBrands();
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadBrands = async () => {
    try {
      const response = await fetch('/api/admin/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const loadProduct = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const product = await response.json();
        setForm({
          name: product.name || '',
          brandId: String(product.brandId || ''),
          price: product.price ? String(product.price) : '',
          volume: product.volume || '',
          description: product.description || '',
          descriptionUser: product.descriptionUser || '',
          imageUrl: product.imageUrl || '',
          step: product.step || '',
          skinTypes: product.skinTypes || [],
          concerns: product.concerns || [],
          activeIngredients: (product.activeIngredients || []).join(', '),
          avoidIf: product.avoidIf || [],
          isHero: product.isHero || false,
          priority: product.priority || 50,
          published: product.published !== false,
        });
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          price: form.price ? Number(form.price) : null,
          priority: Number(form.priority),
          activeIngredients: form.activeIngredients
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        }),
      });

      if (response.ok) {
        router.push('/admin/products');
        router.refresh();
      } else {
        const error = await response.json();
        alert(error.error || 'Ошибка обновления продукта');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Ошибка обновления продукта');
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Редактировать продукт</h1>
      {/* Форма такая же как в new/page.tsx - можно вынести в отдельный компонент */}
      <p className="text-gray-500">Форма редактирования (аналогична форме создания)</p>
      <button
        onClick={() => router.back()}
        className="mt-4 px-6 py-2 border rounded-xl"
      >
        Назад
      </button>
    </div>
  );
}

