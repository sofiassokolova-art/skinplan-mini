// lib/advcake-parse.ts
// Чистый (без БД) разбор XML-выгрузки заказов Adv.Cake + сборка URL экспорта.
// Вынесено отдельно от lib/advcake.ts, чтобы парсер можно было тестировать без
// инициализации Prisma. XML-парсера в зависимостях нет намеренно — структура
// выгрузки плоская и фиксированная, парсим её точечно, без новой зависимости.

export interface AdvcakeBasketItem {
  pid: string | null;
  name: string | null;
  unitPrice: string | null;
  category: string | null;
  qty: number | null;
  commission: string | null;
}

export interface AdvcakeParsedOrder {
  orderId: string;
  offer: string | null;
  offerId: string | null;
  clickId: string | null;
  clickedAt: Date | null;
  orderDate: Date | null;
  dateChange: Date | null;
  price: string | null;
  commission: string | null;
  status: number | null;
  ip: string | null;
  reason: string | null;
  paid: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  bid: string | null;
  category: string | null;
  customer: string | null;
  course: string | null;
  linkHash: string | null;
  landingId: string | null;
  keyword: string | null;
  sub1: string | null;
  basket: AdvcakeBasketItem[];
  raw: Record<string, string>;
}

const BASE = 'https://api.advcake.ru/export/webmaster';

export interface ExportParams {
  days?: number;
  dateFrom?: string;
  dateTo?: string;
  updateFrom?: string;
  updateTo?: string;
  ids?: string;
  offer?: string;
  offerId?: number;
  paid?: 'yes' | 'no';
  paymentStatus?:
    | 'open'
    | 'on_hold'
    | 'balance'
    | 'processing'
    | 'withdrawal'
    | 'not_apply';
  basket?: boolean;
}

/** Собрать URL экспорта. Токен — это секрет (хвост /webmaster/<token>). */
export function buildExportUrl(token: string, p: ExportParams = {}): string {
  const qs = new URLSearchParams();
  if (p.days != null) qs.set('days', String(p.days));
  if (p.dateFrom) qs.set('date_from', p.dateFrom);
  if (p.dateTo) qs.set('date_to', p.dateTo);
  if (p.updateFrom) qs.set('update_from', p.updateFrom);
  if (p.updateTo) qs.set('update_to', p.updateTo);
  if (p.ids) qs.set('ids', p.ids);
  if (p.offer) qs.set('offer', p.offer);
  if (p.offerId != null) qs.set('offer_id', String(p.offerId));
  if (p.paid) qs.set('paid', p.paid);
  if (p.paymentStatus) qs.set('payment_status', p.paymentStatus);
  if (p.basket) qs.set('basket', '1');
  const q = qs.toString();
  return q ? `${BASE}/${token}?${q}` : `${BASE}/${token}`;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Вернуть внутреннее содержимое каждого <item> ВЕРХНЕГО уровня в заданной строке.
 * Глубинно-устойчиво: <item> внутри <basket> вложен и не путается с заказом.
 * Тег <item> атрибутов не имеет, а <items>/</items> не матчатся с <item>/</item>
 * (требуется '>' сразу после "item"), поэтому такой скан безопасен.
 */
function topLevelItems(xml: string): string[] {
  const re = /<item>|<\/item>/g;
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[0] === '<item>') {
      if (depth === 0) start = m.index + m[0].length;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push(xml.slice(start, m.index));
        start = -1;
      } else if (depth < 0) {
        depth = 0; // защита от рассинхрона тегов
      }
    }
  }
  return blocks;
}

function field(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!m) return null;
  const v = unescapeXml(m[1]).trim();
  return v === '' ? null : v;
}

function toInt(v: string | null): number | null {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * "2018-03-16 15:57:04" → Date (или null, если пусто/нераспознаваемо).
 * Adv.Cake отдаёт время по МСК без указания зоны. Фиксируем +03:00 явно, иначе
 * new Date(...) трактовал бы строку в TZ сервера (локально МСК, на Vercel — UTC),
 * и одно и то же время сохранялось бы по-разному в зависимости от среды.
 */
function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v.replace(' ', 'T') + '+03:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBasket(orderBlock: string): AdvcakeBasketItem[] {
  const m = /<basket>([\s\S]*?)<\/basket>/.exec(orderBlock);
  if (!m) return [];
  return topLevelItems(m[1]).map((b) => ({
    pid: field(b, 'pid'),
    name: field(b, 'pn'),
    unitPrice: field(b, 'up'),
    category: field(b, 'pc'),
    qty: toInt(field(b, 'qty')),
    commission: field(b, 'wc'),
  }));
}

/** Разобрать XML-выгрузку в массив заказов. Заказы без <order_id> пропускаются. */
export function parseOrders(xml: string): AdvcakeParsedOrder[] {
  const orders: AdvcakeParsedOrder[] = [];
  for (const block of topLevelItems(xml)) {
    const orderId = field(block, 'order_id');
    if (!orderId) continue;

    const basket = parseBasket(block);
    // Скалярные поля читаем из блока без корзины, чтобы <category> заказа не
    // перепутать с <pc>/прочими тегами внутри basket.
    const scalar = block.replace(/<basket>[\s\S]*?<\/basket>/, '');

    const raw: Record<string, string> = {};
    const tagRe = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(scalar)) !== null) {
      raw[t[1]] = unescapeXml(t[2]).trim();
    }

    orders.push({
      orderId,
      offer: field(scalar, 'offer'),
      offerId: field(scalar, 'offer_id'),
      clickId: field(scalar, 'click_id'),
      clickedAt: toDate(field(scalar, 'clicked_at')),
      orderDate: toDate(field(scalar, 'date')),
      dateChange: toDate(field(scalar, 'dateChange')),
      price: field(scalar, 'price'),
      commission: field(scalar, 'commission'),
      status: toInt(field(scalar, 'status')),
      ip: field(scalar, 'ip'),
      reason: field(scalar, 'reason'),
      paid: field(scalar, 'paid'),
      invoiceId: field(scalar, 'invoice_id'),
      paymentId: field(scalar, 'payment_id'),
      paymentStatus: field(scalar, 'payment_status'),
      bid: field(scalar, 'bid'),
      category: field(scalar, 'category'),
      customer: field(scalar, 'customer'),
      course: field(scalar, 'course'),
      linkHash: field(scalar, 'link_hash'),
      landingId: field(scalar, 'landing_id'),
      keyword: field(scalar, 'keyword'),
      sub1: field(scalar, 'sub1'),
      basket,
      raw,
    });
  }
  return orders;
}
