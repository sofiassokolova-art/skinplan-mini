// app/admin/advcake/page.tsx
// Заказы партнёрской программы Adv.Cake (Gold Apple): сводка + таблица + ручной синк.

'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Wallet, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { AdminPageSkeleton } from '@/components/ui/SkeletonLoader';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  open: 'Неподтверждённая',
  on_hold: 'На холде',
  balance: 'Согласована',
  processing: 'Ожидает оплаты',
  withdrawal: 'Выведена',
  not_apply: 'Не подлежит',
};

interface BasketItem {
  id: string;
  pid: string | null;
  name: string | null;
  unitPrice: number;
  qty: number | null;
  commission: number;
}
interface Order {
  id: string;
  orderId: string;
  orderDate: string | null;
  price: number;
  commission: number;
  status: number | null;
  paid: string | null;
  paymentStatus: string | null;
  sub1: string | null;
  items: BasketItem[];
}
interface Summary {
  orders: number;
  commission: number;
  revenue: number;
  byStatus: { paymentStatus: string | null; orders: number; commission: number }[];
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
}

const money = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

export default function AdvcakeAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [days, setDays] = useState(30);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paid, setPaid] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ days: String(days) });
      if (paymentStatus) qs.set('paymentStatus', paymentStatus);
      if (paid) qs.set('paid', paid);
      const res = await fetch(`/api/admin/advcake?${qs}`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) throw new Error('Ошибка загрузки заказов');
      const data = await res.json();
      setSummary(data.summary);
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Error loading advcake orders:', e);
    } finally {
      setLoading(false);
    }
  }, [days, paymentStatus, paid, router]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    try {
      setSyncing(true);
      setNotice(null);
      const res = await fetch('/api/admin/advcake', { method: 'POST', headers: authHeaders(), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || 'Синк не удался');
      setNotice(`Синхронизировано: получено ${data.fetched}, обновлено ${data.upserted}${data.failed ? `, ошибок ${data.failed}` : ''}`);
      await load();
    } catch (e: any) {
      setNotice(`Ошибка синка: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !summary) return <AdminPageSkeleton cards={3} rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Заказы Adv.Cake</h1>
          <p className="text-gray-600">Партнёрские заказы Gold Apple: статусы и комиссия</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Обновление…' : 'Обновить сейчас'}
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{notice}</div>
      )}

      {/* Сводка */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="text-purple-500" size={24} />
            <div className="text-sm text-gray-600">Заказов за период</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary?.orders ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-green-500" size={24} />
            <div className="text-sm text-gray-600">Комиссия</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{money(summary?.commission ?? 0)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="text-blue-500" size={24} />
            <div className="text-sm text-gray-600">Оборот (price)</div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{money(summary?.revenue ?? 0)}</div>
        </div>
      </div>

      {/* Разбивка по статусу выплаты */}
      {summary && summary.byStatus.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> По статусу выплаты
          </div>
          <div className="flex flex-wrap gap-3">
            {summary.byStatus.map((s) => (
              <div key={s.paymentStatus ?? 'none'} className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2">
                <div className="text-xs text-gray-500">{PAYMENT_STATUS_LABELS[s.paymentStatus ?? ''] ?? s.paymentStatus ?? '—'}</div>
                <div className="text-sm font-semibold text-gray-900">{s.orders} · {money(s.commission)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
          <option value={365}>Год</option>
        </select>
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Любой статус выплаты</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={paid} onChange={(e) => setPaid(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Оплата: любая</option>
          <option value="yes">Оплачен</option>
          <option value="no">Не оплачен</option>
        </select>
      </div>

      {/* Таблица заказов */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Заказ</th>
              <th className="text-left px-4 py-3">Дата</th>
              <th className="text-right px-4 py-3">Сумма</th>
              <th className="text-right px-4 py-3">Комиссия</th>
              <th className="text-left px-4 py-3">Оплата</th>
              <th className="text-left px-4 py-3">Статус выплаты</th>
              <th className="text-left px-4 py-3">sub1</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Нет заказов за период</td></tr>
            )}
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr
                  className={`hover:bg-gray-50 ${o.items.length ? 'cursor-pointer' : ''}`}
                  onClick={() => o.items.length && setExpanded(expanded === o.id ? null : o.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {o.orderId}
                    {o.items.length > 0 && <span className="ml-2 text-xs text-gray-400">{o.items.length} тов.</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('ru-RU') : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{money(o.price)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">{money(o.commission)}</td>
                  <td className="px-4 py-3">
                    <span className={o.paid === 'yes' ? 'text-green-600' : 'text-gray-400'}>{o.paid === 'yes' ? 'Да' : 'Нет'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{PAYMENT_STATUS_LABELS[o.paymentStatus ?? ''] ?? o.paymentStatus ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.sub1 ?? '—'}</td>
                </tr>
                {expanded === o.id && o.items.length > 0 && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="space-y-1">
                        {o.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-xs text-gray-600">
                            <span>{it.name ?? it.pid ?? '—'} {it.qty ? `× ${it.qty}` : ''}</span>
                            <span>{money(it.unitPrice)} · комиссия {money(it.commission)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
