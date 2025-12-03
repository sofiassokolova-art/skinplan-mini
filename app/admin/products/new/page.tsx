// app/admin/products/new/page.tsx
// Страница создания нового продукта

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SelectWithSearch } from '@/components/admin/SelectWithSearch';
import { MultiSelectWithSearch } from '@/components/admin/MultiSelectWithSearch';

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
  // Очищение
  { value: 'cleanser_gentle', label: 'Очищение (мягкое)' },
  { value: 'cleanser_balancing', label: 'Очищение (балансирующее)' },
  { value: 'cleanser_deep', label: 'Очищение (глубокое/кислотное)' },
  // Тоник
  { value: 'toner_hydrating', label: 'Тоник (увлажняющий)' },
  { value: 'toner_soothing', label: 'Тоник (успокаивающий)' },
  // Сыворотки
  { value: 'serum_hydrating', label: 'Сыворотка (увлажняющая)' },
  { value: 'serum_niacinamide', label: 'Сыворотка (ниацинамид)' },
  { value: 'serum_vitc', label: 'Сыворотка (витамин C)' },
  { value: 'serum_anti_redness', label: 'Сыворотка (против покраснений)' },
  { value: 'serum_brightening_soft', label: 'Сыворотка (осветляющая)' },
  // Лечебные средства
  { value: 'treatment_acne_bpo', label: 'Лечение акне (BPO)' },
  { value: 'treatment_acne_azelaic', label: 'Лечение акне (азелаиновая кислота)' },
  { value: 'treatment_acne_local', label: 'Лечение акне (точечное)' },
  { value: 'treatment_exfoliant_mild', label: 'Эксфолиант (мягкий)' },
  { value: 'treatment_exfoliant_strong', label: 'Эксфолиант (сильный)' },
  { value: 'treatment_pigmentation', label: 'Лечение пигментации' },
  { value: 'treatment_antiage', label: 'Антиэйдж' },
  // Увлажняющие кремы
  { value: 'moisturizer_light', label: 'Увлажнение (легкое)' },
  { value: 'moisturizer_balancing', label: 'Увлажнение (балансирующее)' },
  { value: 'moisturizer_barrier', label: 'Увлажнение (барьерное)' },
  { value: 'moisturizer_soothing', label: 'Увлажнение (успокаивающее)' },
  // Кремы для век
  { value: 'eye_cream_basic', label: 'Крем для век (базовый)' },
  { value: 'eye_cream_dark_circles', label: 'Крем для век (темные круги)' },
  { value: 'eye_cream_puffiness', label: 'Крем для век (отеки)' },
  // SPF
  { value: 'spf_50_face', label: 'SPF 50 (для лица)' },
  { value: 'spf_50_oily', label: 'SPF 50 (для жирной кожи)' },
  { value: 'spf_50_sensitive', label: 'SPF 50 (для чувствительной кожи)' },
  // Маски
  { value: 'mask_clay', label: 'Маска (глиняная)' },
  { value: 'mask_hydrating', label: 'Маска (увлажняющая)' },
  { value: 'mask_soothing', label: 'Маска (успокаивающая)' },
  { value: 'mask_sleeping', label: 'Маска (ночная)' },
  // Доп. уход
  { value: 'spot_treatment', label: 'Точечное лечение' },
  { value: 'lip_care', label: 'Уход за губами' },
  { value: 'balm_barrier_repair', label: 'Бальзам (восстановление барьера)' },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Добавить продукт</h1>
        <p className="text-gray-600">Заполните информацию о продукте</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
      {/* === ОСНОВНЫЕ ДАННЫЕ === */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Основная информация</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Название продукта *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
                placeholder="Название продукта"
          />
        </div>
        <div>
              <SelectWithSearch
                label="Бренд"
                required
                value={form.brandId}
                onChange={(value) => setForm({ ...form, brandId: value })}
                options={brands.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                }))}
                placeholder="Выберите бренд"
              />
      </div>

        <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Цена (₽) *</label>
          <input
            type="number"
              required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
                placeholder="0"
          />
        </div>
        <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Объём / вес</label>
          <input
            placeholder="30 мл"
            value={form.volume}
            onChange={(e) => setForm({ ...form, volume: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
          />
        </div>

          <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700">
              Гиперссылка на покупку (Ozon, WB, аптека)
            </label>
            <input
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
            />
      </div>

          <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700">
              Описание (для карточки в приложении)
            </label>
        <textarea
              rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300 resize-none"
                placeholder="Краткое описание продукта"
        />
      </div>

          <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700">
              Полный состав (через запятую или с новой строки)
            </label>
        <textarea
              rows={4}
              value={form.composition}
              onChange={(e) => setForm({ ...form, composition: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300 text-sm resize-none"
              placeholder="Aqua, Niacinamide, Zinc PCA..."
        />
      </div>

          <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700">Фото продукта</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm({ ...form, imageFile: e.target.files?.[0] || null })
              }
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {(form.imageFile || form.imageUrl) && (
                <div className="mt-4">
              <img
                src={
                  form.imageFile
                    ? URL.createObjectURL(form.imageFile)
                    : form.imageUrl
                }
                alt="preview"
                    className="w-64 h-64 object-contain rounded-xl border border-gray-200 bg-gray-50"
              />
                </div>
            )}
            {!form.imageFile && !form.imageUrl && (
              <div className="mt-4">
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                  Или введите URL изображения
                </label>
        <input
          type="url"
                  placeholder="https://..."
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
                />
              </div>
            )}
          </div>
        </div>
      </div>

        {/* === КЛЮЧЕВЫЕ ФИЛЬТРЫ === */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
          Фильтры для рекомендаций (обязательно!)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
              <label className="block text-sm font-medium mb-3 text-gray-700">Тип кожи (можно несколько)</label>
              <div className="space-y-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
              {SKIN_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-3 cursor-pointer hover:bg-white rounded-lg p-2 transition-colors">
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
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                    <span className="text-gray-900">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
              <label className="block text-sm font-medium mb-3 text-gray-700">Проблемы кожи</label>
              <div className="space-y-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
            {CONCERNS.map((c) => (
                  <label key={c.value} className="flex items-center gap-3 cursor-pointer hover:bg-white rounded-lg p-2 transition-colors">
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
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                    <span className="text-gray-900">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
              <SelectWithSearch
                label="Шаг ухода"
                required
                value={form.step}
                onChange={(value) => setForm({ ...form, step: value })}
                options={STEPS.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
                placeholder="Выберите шаг"
              />
          </div>

          <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
            Активные ингредиенты (через запятую)
          </label>
          <input
            value={form.activeIngredients}
            onChange={(e) =>
              setForm({ ...form, activeIngredients: e.target.value })
            }
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-300"
              placeholder="ниацинамид 10%, азелаиновая кислота 15%, ретинол 0.3%"
          />
        </div>

          <div className="md:col-span-2 space-y-4">
        <div>
                <MultiSelectWithSearch
                  label="Избегать при"
                  value={form.avoidIf}
                  onChange={(value) => setForm({ ...form, avoidIf: value })}
                  options={[
                    { value: 'pregnant', label: 'Беременность / ГВ' },
                    { value: 'retinol_allergy', label: 'Аллергия на ретинол / кислоты' },
                  ]}
                  placeholder="Выберите противопоказания"
                  maxDisplay={2}
                />
        </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isHero}
              onChange={(e) => setForm({ ...form, isHero: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
                  <span className="font-medium text-gray-900">
              Герой-рекомендация (выделяется в плане)
            </span>
          </label>

          <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Приоритет (1–100)</label>
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
                    <span className="font-bold text-gray-900 text-xl min-w-[3rem] text-center">{form.priority}</span>
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
            className="flex-1 bg-black text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          {loading ? 'Сохраняем...' : 'Добавить продукт'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
            className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
        >
          Отмена
        </button>
      </div>
    </form>
    </div>
  );
}
