// app/admin/products/new/page.tsx
// Страница создания нового продукта

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Brand {
  id: number;
  name: string;
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
  { value: 'treatment', label: 'Лечение' },
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
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/products', {
        method: 'POST',
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
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Добавить продукт</h1>

      {/* Основные поля */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Название *</label>
          <input
            required
            className="w-full px-4 py-3 rounded-xl border"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Бренд *</label>
          <select
            required
            className="w-full px-4 py-3 rounded-xl border"
            value={form.brandId}
            onChange={(e) => setForm({ ...form, brandId: e.target.value })}
          >
            <option value="">Выберите бренд</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Цена (₽)</label>
          <input
            type="number"
            className="w-full px-4 py-3 rounded-xl border"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Объём</label>
          <input
            placeholder="30 мл"
            className="w-full px-4 py-3 rounded-xl border"
            value={form.volume}
            onChange={(e) => setForm({ ...form, volume: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Шаг ухода *</label>
          <select
            required
            className="w-full px-4 py-3 rounded-xl border"
            value={form.step}
            onChange={(e) => setForm({ ...form, step: e.target.value })}
          >
            <option value="">Выберите</option>
            {STEPS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Описание */}
      <div>
        <label className="block text-sm font-medium mb-2">Полное описание</label>
        <textarea
          className="w-full px-4 py-3 rounded-xl border"
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Краткое описание для карточки</label>
        <textarea
          className="w-full px-4 py-3 rounded-xl border"
          rows={2}
          value={form.descriptionUser}
          onChange={(e) => setForm({ ...form, descriptionUser: e.target.value })}
        />
      </div>

      {/* Фото */}
      <div>
        <label className="block text-sm font-medium mb-2">URL фото продукта</label>
        <input
          type="url"
          className="w-full px-4 py-3 rounded-xl border"
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          placeholder="https://..."
        />
        {form.imageUrl && (
          <img
            src={form.imageUrl}
            alt="Preview"
            className="mt-4 w-48 h-48 object-cover rounded-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Ключевые фильтры */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3">
            Типы кожи (можно несколько)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {SKIN_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.skinTypes.includes(type.value)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      skinTypes: checked
                        ? [...prev.skinTypes, type.value]
                        : prev.skinTypes.filter((t) => t !== type.value),
                    }));
                  }}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">
            Проблемы кожи (можно несколько)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CONCERNS.map((c) => (
              <label key={c.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.concerns.includes(c.value)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      concerns: checked
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
          <label className="block text-sm font-medium mb-2">
            Активные ингредиенты (через запятую)
          </label>
          <input
            placeholder="ниацинамид 10%, азелаиновая кислота, центелла"
            className="w-full px-4 py-3 rounded-xl border"
            value={form.activeIngredients}
            onChange={(e) =>
              setForm({ ...form, activeIngredients: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Избегать при</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.avoidIf.includes('pregnant')}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    avoidIf: e.target.checked
                      ? [...prev.avoidIf, 'pregnant']
                      : prev.avoidIf.filter((x) => x !== 'pregnant'),
                  }));
                }}
              />
              Беременность / ГВ
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.avoidIf.includes('retinol_allergy')}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    avoidIf: e.target.checked
                      ? [...prev.avoidIf, 'retinol_allergy']
                      : prev.avoidIf.filter((x) => x !== 'retinol_allergy'),
                  }));
                }}
              />
              Аллергия на ретинол
            </label>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isHero}
              onChange={(e) => setForm({ ...form, isHero: e.target.checked })}
            />
            <span className="font-medium">
              Герой-рекомендация (выделяется в плане)
            </span>
          </label>
          <div>
            <label className="block text-sm font-medium mb-2">
              Приоритет (0–100)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
                className="w-48"
              />
              <span className="font-bold text-purple-600">{form.priority}</span>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          <span className="font-medium">Опубликован</span>
        </label>
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

