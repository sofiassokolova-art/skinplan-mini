// app/admin/products/[id]/page.tsx
// Страница редактирования продукта

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Brand {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  brandId: number;
  price?: number;
  volume?: string;
  description?: string;
  composition?: string;
  link?: string;
  imageUrl?: string;
  step: string;
  skinTypes?: string[];
  concerns?: string[];
  activeIngredients?: string[];
  avoidIf?: string[];
  isHero?: boolean;
  priority?: number;
  published?: boolean;
}

const SKIN_TYPES = [
  { value: 'oily', label: 'Жирная' },
  { value: 'dry', label: 'Сухая' },
  { value: 'combo', label: 'Комбинированная' },
  { value: 'sensitive', label: 'Чувствительная' },
  { value: 'normal', label: 'Нормальная' },
];

const CONCERNS = [
  { value: 'acne', label: 'Акне' },
  { value: 'pigmentation', label: 'Пигментация' },
  { value: 'barrier', label: 'Барьер' },
  { value: 'dehydration', label: 'Обезвоженность' },
  { value: 'wrinkles', label: 'Морщины' },
  { value: 'pores', label: 'Поры' },
  { value: 'redness', label: 'Покраснения' },
];

const STEPS = [
  { value: 'cleanser', label: 'Очищение' },
  { value: 'toner', label: 'Тонер' },
  { value: 'serum', label: 'Сыворотка' },
  { value: 'moisturizer', label: 'Увлажнение' },
  { value: 'spf', label: 'SPF' },
  { value: 'treatment', label: 'Лечение (кислоты, ретинол)' },
  { value: 'mask', label: 'Маска' },
];

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
    composition: '',
    link: '',
    imageFile: null as File | null,
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const response = await fetch('/api/admin/brands', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });
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
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const product = data.product;
        setForm({
          name: product.name || '',
          brandId: String(product.brandId || ''),
          price: product.price ? String(product.price) : '',
          volume: product.volume || '',
          description: product.description || '',
          composition: product.composition || '',
          link: product.link || '',
          imageFile: null,
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
      let imageUrl = form.imageUrl;
      
      // TODO: Если будет uploadthing, раскомментировать
      // if (form.imageFile) {
      //   const res = await startUpload([form.imageFile]);
      //   imageUrl = res[0].url;
      // }

      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: form.price ? Number(form.price) : null,
          priority: Number(form.priority),
          activeIngredients: form.activeIngredients
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
          imageUrl,
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
    return (
      <div className="text-center py-12">
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
      <h1 className="text-4xl font-black text-gray-900 mb-8">Редактировать продукт</h1>

      {/* === ОСНОВНЫЕ ДАННЫЕ === */}
      <div className="glass rounded-3xl p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Название продукта *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Бренд *</label>
            <select
              required
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-white/20"
            >
              <option value="" className="bg-[#0a0a0a] text-gray-200">Выберите бренд</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#0a0a0a] text-gray-200">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Цена (₽) *</label>
            <input
              type="number"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Объём / вес</label>
            <input
              placeholder="30 мл"
              value={form.volume}
              onChange={(e) => setForm({ ...form, volume: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Гиперссылка на покупку (Ozon, WB, аптека)
            </label>
            <input
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Описание (для карточки в приложении)
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Полный состав (через запятую или с новой строки)
            </label>
            <textarea
              rows={4}
              value={form.composition}
              onChange={(e) => setForm({ ...form, composition: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20 text-sm"
              placeholder="Aqua, Niacinamide, Zinc PCA..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-300">Фото продукта</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, imageFile: e.target.files?.[0] || null })
              }
              className="text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-gray-200 hover:file:bg-white/20"
            />
            {(form.imageFile || form.imageUrl) && (
              <img
                src={
                  form.imageFile
                    ? URL.createObjectURL(form.imageFile)
                    : form.imageUrl
                }
                alt="preview"
                className="mt-4 w-64 rounded-2xl shadow-lg"
              />
            )}
            {!form.imageFile && !form.imageUrl && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Или введите URL изображения
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === КЛЮЧЕВЫЕ ФИЛЬТРЫ (это то, что решает попадание в план) === */}
      <div className="glass rounded-3xl p-8">
        <h3 className="text-2xl font-bold mb-6 text-gray-200">
          Фильтры для рекомендаций (обязательно!)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block font-medium mb-3 text-gray-300">Тип кожи (можно несколько)</label>
            <div className="space-y-2">
              {SKIN_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-3 text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.skinTypes.includes(t.value)}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        skinTypes: e.target.checked
                          ? [...prev.skinTypes, t.value]
                          : prev.skinTypes.filter((x) => x !== t.value),
                      }));
                    }}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium mb-3 text-gray-300">Проблемы кожи</label>
            <div className="space-y-2">
              {CONCERNS.map((c) => (
                <label key={c.value} className="flex items-center gap-3 text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.concerns.includes(c.value)}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        concerns: e.target.checked
                          ? [...prev.concerns, c.value]
                          : prev.concerns.filter((x) => x !== c.value),
                      }));
                    }}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium mb-3 text-gray-300">Шаг ухода *</label>
            <select
              required
              value={form.step}
              onChange={(e) => setForm({ ...form, step: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:border-white/20"
            >
              <option value="" className="bg-[#0a0a0a] text-gray-200">Выберите шаг</option>
              {STEPS.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#0a0a0a] text-gray-200">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-3 text-gray-300">
              Активные ингредиенты (через запятую)
            </label>
            <input
              value={form.activeIngredients}
              onChange={(e) =>
                setForm({ ...form, activeIngredients: e.target.value })
              }
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20"
              placeholder="ниацинамид 10%, азелаиновая кислота 15%, ретинол 0.3%"
            />
          </div>

          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="block font-medium mb-3 text-gray-300">Избегать при</label>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.avoidIf.includes('pregnant')}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        avoidIf: e.target.checked
                          ? [...prev.avoidIf, 'pregnant']
                          : prev.avoidIf.filter((x) => x !== 'pregnant'),
                      }))
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                  />
                  Беременность / ГВ
                </label>
                <label className="flex items-center gap-3 text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.avoidIf.includes('retinol_allergy')}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        avoidIf: e.target.checked
                          ? [...prev.avoidIf, 'retinol_allergy']
                          : prev.avoidIf.filter((x) => x !== 'retinol_allergy'),
                      }))
                    }
                    className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                  />
                  Аллергия на ретинол / кислоты
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isHero}
                  onChange={(e) => setForm({ ...form, isHero: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                />
                <span className="font-medium text-gray-300">
                  Герой-рекомендация (выделяется в плане)
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Приоритет (1–100)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: Number(e.target.value) })
                    }
                    className="w-64"
                  />
                  <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 text-xl">{form.priority}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-black text-white py-5 rounded-2xl font-bold text-xl disabled:opacity-50 hover:bg-gray-800"
        >
          {loading ? 'Сохраняем...' : 'Сохранить изменения'}
        </button>
      <button
          type="button"
        onClick={() => router.back()}
          className="px-8 py-5 border-2 border-white/20 text-gray-300 rounded-2xl hover:bg-white/5 transition-colors"
      >
          Отмена
      </button>
    </div>
    </form>
  );
}
