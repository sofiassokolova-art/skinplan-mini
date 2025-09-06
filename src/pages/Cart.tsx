// src/pages/Cart.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../ui";
import logo from "../assets/skiniq-logo.png";

type CartItem = {
  id?: string;
  name: string;
  step?: "cleanser" | "toner" | "hydrator" | "treatment" | "moisturizer" | "spf";
  timeOfDay?: "morning" | "evening";
  image?: string;
  url?: string;
};

const CART_KEY = "skiniq.cart";

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

const ruTime = (t?: CartItem["timeOfDay"]) =>
  t === "morning" ? "Утро" : t === "evening" ? "Вечер" : "—";

const stepRu: Record<NonNullable<CartItem["step"]>, string> = {
  cleanser: "Очищение",
  toner: "Тонер",
  hydrator: "Увлажнение",
  treatment: "Актив",
  moisturizer: "Крем",
  spf: "SPF",
};

const linkOzon = (q: string) =>
  `https://www.ozon.ru/search/?from_global=true&text=${encodeURIComponent(q)}`;
const linkWB = (q: string) =>
  `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(q)}`;
const linkGoogle = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${q} купить`)}`;

export default function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const isEmpty = items.length === 0;

  const removeAt = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const clearAll = () => setItems([]);

  const Header = () => (
    <div className="flex items-center justify-between mb-5">
      <h1 className="text-2xl font-bold">Корзина</h1>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate("/plan")}>
          Вернуться к плану
        </Button>
        {!isEmpty && (
          <Button variant="ghost" onClick={clearAll} aria-label="Очистить корзину">
            Очистить корзину
          </Button>
        )}
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <Header />
        <Card className="p-8 text-center">
          <img src={logo} alt="SkinIQ" className="mx-auto mb-4 w-16 h-16 opacity-80" />
          <h2 className="text-xl font-semibold mb-2">Пока тут пусто…</h2>
          <p className="opacity-70 mb-4">
            Добавьте продукты из плана ухода — они появятся здесь.
          </p>
          <Button onClick={() => navigate("/plan")}>Перейти к плану</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <Header />

      <div className="space-y-3">
        {items.map((it, idx) => (
          <Card key={`${it.timeOfDay}-${it.step}-${it.name}-${idx}`} className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-neutral-200 bg-white">
                <img
                  src={it.image || logo}
                  alt={it.name}
                  className="w-full h-full object-contain p-1.5"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-xs opacity-60">
                  {ruTime(it.timeOfDay)} • {it.step ? stepRu[it.step] : "Шаг"}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {it.url ? (
                    <a
                      className="inline-flex items-center rounded-xl px-3 py-1.5 border border-neutral-300 hover:border-black text-sm"
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Купить
                    </a>
                  ) : (
                    <>
                      <a
                        className="inline-flex items-center rounded-xl px-3 py-1.5 border border-neutral-300 hover:border-black text-sm"
                        href={linkOzon(it.name)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Купить на OZON
                      </a>
                      <a
                        className="inline-flex items-center rounded-xl px-3 py-1.5 border border-neutral-300 hover:border-black text-sm"
                        href={linkWB(it.name)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Купить на WB
                      </a>
                      <a
                        className="inline-flex items-center rounded-xl px-3 py-1.5 border border-neutral-300 hover:border-black text-sm"
                        href={linkGoogle(it.name)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Поиск в Google
                      </a>
                    </>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                aria-label="Удалить"
                onClick={() => removeAt(idx)}
                className="shrink-0"
                title="Удалить"
              >
                ✕
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm opacity-70">Позиции: {items.length}</div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/plan")}>
            Добавить ещё
          </Button>
          <Button variant="ghost" onClick={clearAll}>Очистить корзину</Button>
        </div>
      </div>
    </div>
  );
}
