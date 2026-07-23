// app/admin/promo-codes/page.tsx
// Управление промокодами: создание, редактирование, вкл/выкл, удаление.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, Plus, Pencil, Trash2, Power, X } from 'lucide-react';
import { PAYMENT_PRODUCT_LABELS, PAYMENT_PRODUCTS } from '@/lib/payment-products';
import { AdminPageSkeleton } from '@/components/ui/SkeletonLoader';

type DiscountType = 'percent' | 'fixed' | 'override_price';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  active: boolean;
  discountType: DiscountType;
  discountValue: number;
  appliesToProductCodes: string[];
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  redemptionCount: number;
}

const PRODUCT_CODES = Object.keys(PAYMENT_PRODUCTS);

const emptyForm = {
  code: '',
  description: '',
  discountType: 'percent' as DiscountType,
  value: '',
  products: [] as string[],
  maxRedemptions: '',
  maxRedemptionsPerUser: '1',
  startsAt: '',
  expiresAt: '',
  active: true,
};

type FormState = typeof emptyForm;

function formatRub(kopecks: number): string {
  return (kopecks / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function discountLabel(promo: Pick<PromoCode, 'discountType' | 'discountValue'>): string {
  if (promo.discountType === 'percent') return `−${promo.discountValue}%`;
  if (promo.discountType === 'fixed') return `−${formatRub(promo.discountValue)} ₽`;
  return `${formatRub(promo.discountValue)} ₽ фикс.`;
}

function promoStatus(promo: PromoCode): { label: string; cls: string } {
  if (!promo.active) return { label: 'Выключен', cls: 'bg-gray-200 text-gray-600' };
  const now = Date.now();
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) {
    return { label: 'Ожидает', cls: 'bg-amber-100 text-amber-700' };
  }
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() <= now) {
    return { label: 'Истёк', cls: 'bg-red-100 text-red-700' };
  }
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return { label: 'Исчерпан', cls: 'bg-red-100 text-red-700' };
  }
  return { label: 'Активен', cls: 'bg-emerald-100 text-emerald-700' };
}

/** ISO -> значение для <input type="datetime-local"> в локальной зоне. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromoCodesAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    void loadPromoCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  async function loadPromoCodes() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/promo-codes', {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) throw new Error('Не удалось загрузить промокоды');
      const data = await res.json();
      setPromoCodes(data.promoCodes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const valueLabel = useMemo(() => {
    if (form.discountType === 'percent') return 'Скидка, %';
    if (form.discountType === 'fixed') return 'Размер скидки, ₽';
    return 'Итоговая цена, ₽';
  }, [form.discountType]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(promo: PromoCode) {
    setForm({
      code: promo.code,
      description: promo.description ?? '',
      discountType: promo.discountType,
      value:
        promo.discountType === 'percent'
          ? String(promo.discountValue)
          : String(promo.discountValue / 100),
      products: [...promo.appliesToProductCodes],
      maxRedemptions: promo.maxRedemptions != null ? String(promo.maxRedemptions) : '',
      maxRedemptionsPerUser: String(promo.maxRedemptionsPerUser),
      startsAt: toLocalInput(promo.startsAt),
      expiresAt: toLocalInput(promo.expiresAt),
      active: promo.active,
    });
    setEditingId(promo.id);
    setFormError(null);
    setShowForm(true);
  }

  function toggleProduct(code: string) {
    setForm((prev) => ({
      ...prev,
      products: prev.products.includes(code)
        ? prev.products.filter((c) => c !== code)
        : [...prev.products, code],
    }));
  }

  async function handleSubmit() {
    setFormError(null);

    const rawValue = Number(form.value);
    if (!form.value.trim() || Number.isNaN(rawValue)) {
      setFormError('Укажите числовое значение скидки');
      return;
    }
    const discountValue =
      form.discountType === 'percent' ? Math.round(rawValue) : Math.round(rawValue * 100);

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      code: form.code,
      description: form.description,
      discountType: form.discountType,
      discountValue,
      appliesToProductCodes: form.products,
      maxRedemptions: form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null,
      maxRedemptionsPerUser: form.maxRedemptionsPerUser.trim()
        ? Number(form.maxRedemptionsPerUser)
        : 1,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      active: form.active,
    };

    try {
      setSaving(true);
      const res = await fetch('/api/admin/promo-codes', {
        method: editingId ? 'PATCH' : 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error || 'Не удалось сохранить промокод');
        return;
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadPromoCodes();
    } catch {
      setFormError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(promo: PromoCode) {
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ id: promo.id, active: !promo.active }),
      });
      if (!res.ok) return;
      await loadPromoCodes();
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(promo: PromoCode) {
    const used = promo.redemptionCount > 0;
    const message = used
      ? `Промокод ${promo.code} уже использовали (${promo.redemptionCount}). Он будет деактивирован. Продолжить?`
      : `Удалить промокод ${promo.code}?`;
    if (!window.confirm(message)) return;
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${encodeURIComponent(promo.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return;
      await loadPromoCodes();
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <AdminPageSkeleton cards={3} rows={6} />;
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={24} /> Промокоды
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Скидки применяются на сервере перед созданием платежа
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors shadow-sm"
        >
          <Plus size={18} /> Новый промокод
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200/60">
                <th className="px-4 py-3 font-semibold">Код</th>
                <th className="px-4 py-3 font-semibold">Скидка</th>
                <th className="px-4 py-3 font-semibold">Продукты</th>
                <th className="px-4 py-3 font-semibold">Использовано</th>
                <th className="px-4 py-3 font-semibold">Срок</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Промокодов пока нет. Создайте первый.
                  </td>
                </tr>
              )}
              {promoCodes.map((promo) => {
                const status = promoStatus(promo);
                return (
                  <tr key={promo.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 tracking-wide">{promo.code}</div>
                      {promo.description && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-[220px] truncate">
                          {promo.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {discountLabel(promo)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {promo.appliesToProductCodes.length === 0 ? (
                        <span className="text-gray-400">Все продукты</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {promo.appliesToProductCodes.map((code) => (
                            <span
                              key={code}
                              className="inline-block bg-gray-100 text-gray-600 rounded-md px-1.5 py-0.5 text-xs"
                            >
                              {PAYMENT_PRODUCT_LABELS[code] || code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {promo.redemptionCount}
                      {promo.maxRedemptions != null ? ` / ${promo.maxRedemptions}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {promo.expiresAt
                        ? `до ${new Date(promo.expiresAt).toLocaleDateString('ru-RU')}`
                        : 'бессрочно'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleActive(promo)}
                          title={promo.active ? 'Выключить' : 'Включить'}
                          className={`p-2 rounded-lg transition-colors ${
                            promo.active
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(promo)}
                          title="Изменить"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(promo)}
                          title="Удалить"
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm p-4"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Редактирование промокода' : 'Новый промокод'}
              </h2>
              <button
                onClick={() => !saving && setShowForm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Код</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SKIN50"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none font-semibold tracking-wide uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Описание (необязательно)
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Летняя акция"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Тип скидки</label>
                  <select
                    value={form.discountType}
                    onChange={(e) =>
                      setForm({ ...form, discountType: e.target.value as DiscountType })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none bg-white"
                  >
                    <option value="percent">Процент</option>
                    <option value="fixed">Фикс. скидка</option>
                    <option value="override_price">Фикс. цена</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{valueLabel}</label>
                  <input
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    inputMode="decimal"
                    placeholder={form.discountType === 'percent' ? '50' : '99'}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>
              {form.discountType === 'override_price' && (
                <p className="text-xs text-gray-400 -mt-2">
                  Итоговая цена после промокода. 0 — доступ бесплатно.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Продукты
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_CODES.map((code) => {
                    const selected = form.products.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleProduct(code)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {PAYMENT_PRODUCT_LABELS[code] || code}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Ничего не выбрано — промокод действует на все продукты.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Лимит всего
                  </label>
                  <input
                    value={form.maxRedemptions}
                    onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                    inputMode="numeric"
                    placeholder="без лимита"
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Лимит на юзера
                  </label>
                  <input
                    value={form.maxRedemptionsPerUser}
                    onChange={(e) => setForm({ ...form, maxRedemptionsPerUser: e.target.value })}
                    inputMode="numeric"
                    placeholder="1"
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Начало (необязательно)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Окончание (необязательно)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 focus:border-gray-900 outline-none text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 accent-gray-900"
                />
                <span className="text-sm text-gray-700">Активен сразу</span>
              </label>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => !saving && setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
