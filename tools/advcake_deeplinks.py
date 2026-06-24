#!/usr/bin/env python3
"""
advcake_deeplinks.py — генерация партнёрских (deeplink) ссылок Adv.Cake
для Gold Apple (goldapple.ru) из списка обычных URL.

Два режима:

  template  — подстановка url-кодированного адреса в шаблон с плейсхолдером {dl}.
              Ключ не нужен, сети нет, работает для любого объёма ссылок.
              Шаблон берётся из кабинета Adv.Cake (раздел «Создать ссылку»),
              вид: https://go.acstat.com/XXXX?dl={dl}

  api       — запрос к Cakelink API:
              https://cakelink.ru/link?dl=<deeplink>&pass=<API-key>
              Возвращает JSON, поле "url" — готовая ссылка.

Вход:  txt-файл, по одной ссылке goldapple.ru на строку (пустые/«#» игнорируются).
Выход: CSV (source_url, affiliate_url[, error]).

Примеры:
  python advcake_deeplinks.py urls.txt --mode template \
      --template "https://go.acstat.com/XXXX?dl={dl}" -o out.csv

  python advcake_deeplinks.py urls.txt --mode api \
      --api-key "$ADVCAKE_KEY" -o out.csv

Ключ передавайте через переменную окружения или аргумент — не хардкодьте в файл.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from urllib.parse import quote, urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


CAKELINK_ENDPOINT = "https://cakelink.ru/link"


def read_urls(path: str) -> list[str]:
    urls: list[str] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            s = line.strip()
            if s and not s.startswith("#"):
                urls.append(s)
    return urls


def build_template(url: str, template: str) -> str:
    if "{dl}" not in template:
        raise ValueError("В шаблоне нет плейсхолдера {dl}")
    # safe="" — кодируем и слэши/двоеточия, чтобы deeplink корректно ушёл в параметр
    return template.replace("{dl}", quote(url, safe=""))


def build_api(url: str, api_key: str, timeout: float) -> str:
    qs = urlencode({"dl": url, "pass": api_key})
    req = Request(f"{CAKELINK_ENDPOINT}?{qs}", headers={"User-Agent": "advcake-deeplinks/1.0"})
    with urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    link = data.get("url")
    if not link:
        raise ValueError(f"API не вернул url: {data}")
    return link


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Генератор партнёрских ссылок Adv.Cake")
    p.add_argument("input", help="txt-файл со ссылками goldapple.ru (по одной на строку)")
    p.add_argument("--mode", choices=("template", "api"), default="template")
    p.add_argument("--template", help="шаблон с {dl} (для --mode template)")
    p.add_argument("--api-key", help="API-ключ Cakelink (для --mode api)")
    p.add_argument("-o", "--output", default="-", help="CSV-файл (по умолчанию stdout)")
    p.add_argument("--delay", type=float, default=0.2, help="пауза между API-запросами, сек")
    p.add_argument("--timeout", type=float, default=15.0, help="таймаут API-запроса, сек")
    args = p.parse_args(argv)

    if args.mode == "template" and not args.template:
        p.error("--mode template требует --template")
    if args.mode == "api" and not args.api_key:
        p.error("--mode api требует --api-key")

    urls = read_urls(args.input)
    if not urls:
        print("Нет ссылок во входном файле", file=sys.stderr)
        return 1

    out = sys.stdout if args.output == "-" else open(args.output, "w", newline="", encoding="utf-8")
    writer = csv.writer(out)
    writer.writerow(["source_url", "affiliate_url", "error"])

    ok = 0
    for url in urls:
        try:
            if args.mode == "template":
                link = build_template(url, args.template)
            else:
                link = build_api(url, args.api_key, args.timeout)
                if args.delay:
                    time.sleep(args.delay)
            writer.writerow([url, link, ""])
            ok += 1
        except (HTTPError, URLError, ValueError) as exc:
            writer.writerow([url, "", str(exc)])

    if out is not sys.stdout:
        out.close()
    print(f"Готово: {ok}/{len(urls)} ссылок", file=sys.stderr)
    return 0 if ok == len(urls) else 2


if __name__ == "__main__":
    raise SystemExit(main())
