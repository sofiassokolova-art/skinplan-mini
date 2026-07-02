// lib/advcake.ts
// Синхронизация заказов Adv.Cake в БД: тянем XML-выгрузку, парсим (lib/advcake-parse)
// и upsert-им по orderId, чтобы повторные выгрузки обновляли статусы/комиссию,
// а не плодили дубли. Позиции корзины при ресинке пересоздаются.

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildExportUrl,
  parseOrders,
  type ExportParams,
  type AdvcakeParsedOrder,
} from '@/lib/advcake-parse';

export interface SyncResult {
  fetched: number;
  upserted: number;
  failed: number;
}

/** Токен экспорта — секрет; только из окружения, никогда не в коде/репозитории. */
function getToken(): string {
  const token = process.env.ADVCAKE_EXPORT_TOKEN;
  if (!token) {
    throw new Error('ADVCAKE_EXPORT_TOKEN is not set');
  }
  return token;
}

async function fetchOrdersXml(params: ExportParams, timeoutMs = 25000): Promise<string> {
  const url = buildExportUrl(getToken(), params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'skinplan-advcake-sync/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Adv.Cake export HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function orderData(o: AdvcakeParsedOrder) {
  // Поля для create/update (без orderId — он в where; без items — они вложенно).
  return {
    offer: o.offer,
    offerId: o.offerId,
    clickId: o.clickId,
    clickedAt: o.clickedAt,
    orderDate: o.orderDate,
    dateChange: o.dateChange,
    price: o.price,
    commission: o.commission,
    status: o.status,
    ip: o.ip,
    reason: o.reason,
    paid: o.paid,
    invoiceId: o.invoiceId,
    paymentId: o.paymentId,
    paymentStatus: o.paymentStatus,
    bid: o.bid,
    category: o.category,
    customer: o.customer,
    course: o.course,
    linkHash: o.linkHash,
    landingId: o.landingId,
    keyword: o.keyword,
    sub1: o.sub1,
    raw: o.raw,
    syncedAt: new Date(),
  };
}

function itemsCreate(o: AdvcakeParsedOrder) {
  return o.basket.map((b) => ({
    pid: b.pid,
    name: b.name,
    unitPrice: b.unitPrice,
    category: b.category,
    qty: b.qty,
    commission: b.commission,
  }));
}

/**
 * Полный синк: запросить выгрузку, распарсить, upsert-нуть каждый заказ.
 * Каждый заказ обрабатывается независимо — сбой одного не валит остальные.
 */
export async function syncAdvcakeOrders(
  params: ExportParams = { days: 7, basket: true },
): Promise<SyncResult> {
  const xml = await fetchOrdersXml(params);
  const orders = parseOrders(xml);

  let upserted = 0;
  let failed = 0;

  for (const o of orders) {
    try {
      const data = orderData(o);
      const create = itemsCreate(o);
      await prisma.advcakeOrder.upsert({
        where: { orderId: o.orderId },
        create: {
          orderId: o.orderId,
          ...data,
          items: create.length ? { create } : undefined,
        },
        update: {
          ...data,
          // Корзину пересоздаём, чтобы убрать ушедшие позиции и подтянуть новые.
          items: { deleteMany: {}, ...(create.length ? { create } : {}) },
        },
      });
      upserted += 1;
    } catch (e) {
      failed += 1;
      logger.warn('Adv.Cake upsert failed', { orderId: o.orderId, error: e });
    }
  }

  logger.info('Adv.Cake sync finished', { fetched: orders.length, upserted, failed });
  return { fetched: orders.length, upserted, failed };
}
