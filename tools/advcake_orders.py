#!/usr/bin/env python3
"""
advcake_orders.py — выгрузка заказов Adv.Cake (webmaster export) в CSV/JSON.

Дёргает XML-выгрузку:
    https://api.advcake.ru/export/webmaster/<TOKEN>[?params]
парсит <items>/<item> (с опциональной <basket>) и пишет CSV или JSON.

ТОКЕН (хвост /webmaster/<TOKEN>) — это секрет, доступ ко всем заказам.
Не хардкодьте его. Скрипт берёт токен из переменной окружения
ADVCAKE_EXPORT_TOKEN или из флага --token.

Поддерживаемые фильтры (как в доке Adv.Cake):
    --days N                  заказы за N дней (1..7), по умолчанию у API = 1
    --date-from / --date-to   диапазон создания, YYYY-MM-DD (включительно)
    --update-from/--update-to диапазон обновления, YYYY-MM-DD
    --ids 123,456             конкретные order_id через запятую
    --offer goldappleru       алиас оффера
    --offer-id 779            id оффера
    --paid yes|no             оплачен / нет
    --payment-status STATUS   open|on_hold|balance|processing|withdrawal|not_apply
    --basket                  включить корзину (только ecommerce-офферы)

Формат вывода:
    --format csv (по умолчанию)  плоская таблица заказов; при --basket
                                 добавляется по строке на каждый товар корзины
                                 (поля basket_* заполнены, для строки заказа — пустые).
    --format json                полная вложенная структура, корзина внутри заказа.

Примеры:
    export ADVCAKE_EXPORT_TOKEN=*****
    python advcake_orders.py --days 7 --payment-status balance -o orders.csv
    python advcake_orders.py --offer goldappleru --basket --format json -o orders.json

    # офлайн-разбор уже сохранённого XML (без обращения к API):
    python advcake_orders.py --from-file response.xml -o orders.csv
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


BASE = "https://api.advcake.ru/export/webmaster"

# Плоские поля заказа (всё, что не <basket>). Порядок = порядок колонок CSV.
ORDER_FIELDS = [
    "offer", "offer_id", "order_id", "click_id", "clicked_at", "date",
    "dateChange", "price", "commission", "status", "ip", "reason", "paid",
    "invoice_id", "payment_id", "payment_status", "bid", "category",
    "customer", "course", "link_hash", "landing_id", "keyword", "sub1",
]
BASKET_FIELDS = ["pid", "pn", "up", "pc", "qty", "wc"]


def build_url(token: str, args: argparse.Namespace) -> str:
    params: dict[str, str] = {}
    if args.days is not None:
        params["days"] = str(args.days)
    if args.date_from:
        params["date_from"] = args.date_from
    if args.date_to:
        params["date_to"] = args.date_to
    if args.update_from:
        params["update_from"] = args.update_from
    if args.update_to:
        params["update_to"] = args.update_to
    if args.ids:
        params["ids"] = args.ids
    if args.offer:
        params["offer"] = args.offer
    if args.offer_id:
        params["offer_id"] = str(args.offer_id)
    if args.paid:
        params["paid"] = args.paid
    if args.payment_status:
        params["payment_status"] = args.payment_status
    if args.basket:
        params["basket"] = "1"
    url = f"{BASE}/{token}"
    if params:
        url += "?" + urlencode(params)
    return url


def fetch_xml(url: str, timeout: float) -> bytes:
    req = Request(url, headers={"User-Agent": "advcake-orders/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def parse_orders(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    orders: list[dict] = []
    for item in root.findall("item"):
        order: dict = {}
        basket: list[dict] = []
        for child in item:
            if child.tag == "basket":
                for bi in child.findall("item"):
                    basket.append({f.tag: (f.text or "").strip() for f in bi})
            else:
                order[child.tag] = (child.text or "").strip()
        if basket:
            order["basket"] = basket
        orders.append(order)
    return orders


def write_csv(orders: list[dict], out: io.TextIOBase, with_basket: bool) -> None:
    cols = list(ORDER_FIELDS)
    if with_basket:
        cols += [f"basket_{f}" for f in BASKET_FIELDS]
    writer = csv.DictWriter(out, fieldnames=cols, extrasaction="ignore")
    writer.writeheader()
    for o in orders:
        base = {k: o.get(k, "") for k in ORDER_FIELDS}
        items = o.get("basket")
        if with_basket and items:
            for bi in items:
                row = dict(base)
                row.update({f"basket_{k}": bi.get(k, "") for k in BASKET_FIELDS})
                writer.writerow(row)
        else:
            writer.writerow(base)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Выгрузка заказов Adv.Cake → CSV/JSON")
    p.add_argument("--token", default=os.environ.get("ADVCAKE_EXPORT_TOKEN"),
                   help="export-токен (или переменная ADVCAKE_EXPORT_TOKEN)")
    p.add_argument("--from-file", help="разобрать локальный XML вместо запроса к API")
    p.add_argument("--days", type=int, choices=range(1, 8), metavar="1..7")
    p.add_argument("--date-from")
    p.add_argument("--date-to")
    p.add_argument("--update-from")
    p.add_argument("--update-to")
    p.add_argument("--ids", help="order_id через запятую")
    p.add_argument("--offer", help="алиас оффера, напр. goldappleru")
    p.add_argument("--offer-id", type=int)
    p.add_argument("--paid", choices=("yes", "no"))
    p.add_argument("--payment-status",
                   choices=("open", "on_hold", "balance", "processing",
                            "withdrawal", "not_apply"))
    p.add_argument("--basket", action="store_true")
    p.add_argument("--format", choices=("csv", "json"), default="csv")
    p.add_argument("-o", "--output", default="-", help="файл вывода (по умолчанию stdout)")
    p.add_argument("--timeout", type=float, default=30.0)
    args = p.parse_args(argv)

    try:
        if args.from_file:
            with open(args.from_file, "rb") as fh:
                xml_bytes = fh.read()
        else:
            if not args.token:
                p.error("нужен --token или переменная ADVCAKE_EXPORT_TOKEN "
                        "(либо --from-file для офлайн-разбора)")
            url = build_url(args.token, args)
            xml_bytes = fetch_xml(url, args.timeout)
    except (HTTPError, URLError, OSError) as exc:
        print(f"Ошибка запроса/чтения: {exc}", file=sys.stderr)
        return 1

    try:
        orders = parse_orders(xml_bytes)
    except ET.ParseError as exc:
        print(f"Не удалось разобрать XML: {exc}", file=sys.stderr)
        return 1

    out = sys.stdout if args.output == "-" else open(args.output, "w", newline="", encoding="utf-8")
    if args.format == "json":
        json.dump(orders, out, ensure_ascii=False, indent=2)
        out.write("\n")
    else:
        write_csv(orders, out, with_basket=args.basket)
    if out is not sys.stdout:
        out.close()

    print(f"Заказов: {len(orders)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
