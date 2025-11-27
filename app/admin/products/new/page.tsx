// app/admin/products/new/page.tsx
// Страница создания нового продукта

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Brand {
  id: number;
  name: string;
}

interface Product {
  id?: number;
  name?: string;
  brandId?: number;
  price?: number;
  volume?: string;
  description?: string;
  composition?: string;
  link?: string;
  imageUrl?: string;
  step?: string;
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

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
  }, []);

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
      const response = await fetch('/api/admin/products', {
        method: 'POST',
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
        alert(error.error || 'Ошибка создания продукта');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Ошибка создания продукта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold">Добавить продукт</h1>

      {/* === ОСНОВНЫЕ ДАННЫЕ === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-3xl p-6 shadow">
        <div>
          <label className="block text-sm font-medium mb-2">Название продукта *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Бренд *</label>
          <select
            required
            value={form.brandId}
            onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
          >
            <option value="">Выберите бренд</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
      </div>

        <div>
          <label className="block text-sm font-medium mb-2">Цена (₽) *</label>
          <input
            type="number"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Объём / вес</label>
          <input
            placeholder="30 мл"
            value={form.volume}
            onChange={(e) => setForm({ ...form, volume: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Гиперссылка на покупку (Ozon, WB, аптека)
          </label>
          <input
            placeholder="https://..."
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
          />
      </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Описание (для карточки в приложении)
          </label>
        <textarea
            rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border"
        />
      </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Полный состав (через запятую или с новой строки)
          </label>
        <textarea
            rows={4}
            value={form.composition}
            onChange={(e) => setForm({ ...form, composition: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-sm"
            placeholder="Aqua, Niacinamide, Zinc PCA..."
        />
      </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Фото продукта</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setForm({ ...form, imageFile: e.target.files?.[0] || null })
            }
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
              <label className="block text-sm font-medium mb-2">
                Или введите URL изображения
              </label>
        <input
          type="url"
                placeholder="https://..."
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border"
          />
            </div>
        )}
        </div>
      </div>

      {/* === КЛЮЧЕВЫЕ ФИЛЬТРЫ (это то, что решает попадание в план) === */}
      <div className="bg-purple-50 rounded-3xl p-6">
        <h3 className="text-xl font-bold mb-6 text-purple-800">
          Фильтры для рекомендаций (обязательно!)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
            <label className="block font-medium mb-3">Тип кожи (можно несколько)</label>
            <div className="space-y-2">
              {SKIN_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-3">
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
                />
                  <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
            <label className="block font-medium mb-3">Проблемы кожи</label>
            <div className="space-y-2">
            {CONCERNS.map((c) => (
                <label key={c.value} className="flex items-center gap-3">
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
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
            <label className="block font-medium mb-3">Шаг ухода *</label>
            <select
              required
              value={form.step}
              onChange={(e) => setForm({ ...form, step: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border"
            >
              <option value="">Выберите шаг</option>
              {STEPS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-3">
            Активные ингредиенты (через запятую)
          </label>
          <input
            value={form.activeIngredients}
            onChange={(e) =>
              setForm({ ...form, activeIngredients: e.target.value })
            }
              className="w-full px-4 py-3 rounded-xl border"
              placeholder="ниацинамид 10%, азелаиновая кислота 15%, ретинол 0.3%"
          />
        </div>

          <div className="md:col-span-2 space-y-4">
        <div>
              <label className="block font-medium mb-3">Избегать при</label>
              <div className="flex gap-8">
                <label className="flex items-center gap-3">
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
              />
              Беременность / ГВ
            </label>
                <label className="flex items-center gap-3">
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
              />
                  Аллергия на ретинол / кислоты
            </label>
          </div>
        </div>

            <div className="flex items-center justify-between">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isHero}
              onChange={(e) => setForm({ ...form, isHero: e.target.checked })}
            />
                <span className="font-medium text-purple-700">
              Герой-рекомендация (выделяется в плане)
            </span>
          </label>

          <div>
                <label className="block text-sm font-medium mb-2">Приоритет (1–100)</label>
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
                  <span className="font-bold text-purple-600 text-xl">{form.priority}</span>
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
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-5 rounded-2xl font-bold text-xl disabled:opacity-50"
        >
          {loading ? 'Сохраняем...' : 'Добавить продукт'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-8 py-5 border-2 border-gray-300 rounded-2xl"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
