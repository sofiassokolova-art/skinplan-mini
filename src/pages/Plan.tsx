// src/pages/Plan.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Progress } from "../ui";
import SkinMetrics from "../ui/SkinMetrics";
import { computeSkinMetrics, generateCarePlan, generate28DaySchedule } from "../lib/plan";
import type { CarePlan, DayPlan } from "../lib/plan";
import * as storage from "../lib/storage";
import { sendToTG } from "../lib/tg";

type Answers = Parameters<typeof computeSkinMetrics>[0];

const PREMIUM_KEY = "skiniq.premium";
const CART_KEY = "skiniq.cart";

function isPaid(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === "true";
  } catch {
    return false;
  }
}

function persistPaid(v: boolean) {
  try {
    localStorage.setItem(PREMIUM_KEY, v ? "true" : "false");
  } catch {}
}

/** Простая локальная корзина (если у тебя уже есть в storage — можно заменить импорты) */
function getCart(): any[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}
function setCart(items: any[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}
function addToCart(item: any) {
  const cart = getCart();
  // избегаем дубликатов по name+timeOfDay+step
  if (!cart.some((x) => x.name === item.name && x.timeOfDay === item.timeOfDay && x.step === item.step)) {
    cart.push(item);
    setCart(cart);
  }
}

export default function Plan() {
  const navigate = useNavigate();

  // 1) читаем ответы и делаем маппинг
  const answers: Answers = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("skiniq.answers") || "{}");
    } catch {
      return {};
    }
  }, []);

  const hasAnswers = useMemo(() => {
    if (!answers) return false;
    return Object.keys(answers).length > 0 && typeof (answers as any).name === "string" && ((answers as any).name as string).trim().length > 0;
  }, [answers]);

  // Если анкета не пройдена — отправляем на /quiz
  useEffect(() => {
    if (!hasAnswers) {
      navigate("/quiz");
    }
  }, [hasAnswers, navigate]);

  const metrics = useMemo(() => computeSkinMetrics(answers), [answers]);
  const plan: CarePlan = useMemo(() => generateCarePlan(metrics), [metrics]);
  const schedule28: DayPlan[] = useMemo(() => generate28DaySchedule(metrics), [metrics]);

  // 2) premium-gate
  const [paid, setPaidState] = useState<boolean>(isPaid());
  const unlock = async () => {
    persistPaid(true);
    setPaidState(true);
  };
  const setPaidFlag = (v: boolean) => {
    setPaidState(v);
    persistPaid(v);
  };

  // 3) экспорт
  const planToText = () => {
    const lines: string[] = [];
    lines.push(`SkinIQ — персональный план ухода (28 дней)`);
    lines.push(`Тип кожи: ${metrics.skinType}; Чувствительность: ${metrics.sensitivity ? "да" : "нет"}; Жирность: ${metrics.oiliness}`);
    if (metrics.concerns?.length) lines.push(`Проблемы: ${metrics.concerns.join(", ")}`);
    lines.push(`Цель: ${metrics.primaryGoal}`);
    lines.push(`\nУтро:`);
    plan.morning.forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
    lines.push(`\nВечер:`);
    plan.evening.forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
    lines.push(`\nРасписание 28 дней (кратко):`);
    schedule28.forEach((d) => {
      lines.push(
        `День ${d.day}: утро — ${d.morningNotes.join("; ")} | вечер — ${d.eveningNotes.join("; ")}`
      );
    });
    return lines.join("\n");
  };

  const exportToTelegram = () => {
    const payload = { type: "plan", text: planToText() };
    // если это Telegram WebApp — отправим боту
    if ((window as any)?.Telegram?.WebApp?.sendData) {
      (window as any).Telegram.WebApp.sendData(JSON.stringify(payload));
      alert("План отправлен в чат боту.");
    } else {
      const { ok } = sendToTG(payload);
      if (ok) {
        alert("План отправлен в чат боту.");
      } else {
        // fallback: копирование
        navigator.clipboard.writeText(payload.text);
        alert("Я скопировал план в буфер обмена — вставь в чат вручную.");
      }
    }
  };

  const exportToPDF = () => {
    // простой принт-вид: браузер позволит сохранить как PDF
    window.print();
  };

  // 4) add to cart
  const addAllToCart = () => {
    [...plan.morning, ...plan.evening].forEach(addToCart);
    alert("Все продукты добавлены в корзину.");
  };

  useEffect(() => {
    // сохраним план, чтобы Главная показывала «Ближайшую рутину»
    try {
      localStorage.setItem("skiniq.plan", JSON.stringify(plan));
    } catch {}
  }, [plan]);

  // UI helpers
  const Blurred: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative">
      <div className="pointer-events-none select-none blur-md brightness-95">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
        <div className="text-center">
          <div className="text-lg font-semibold mb-1">Персональные рекомендации</div>
          <div className="opacity-70 mb-3">Разблокируй план ухода и расписание на 28 дней</div>
        </div>
        <Button onClick={unlock}>Разблокировать рекомендации за 199₽</Button>
        <div className="text-xs opacity-60">Оплата единовременная · доступ сразу</div>
      </div>
    </div>
  );

  const ProductsBlock: React.FC<{ title: string; items: CarePlan["morning"] }> = ({ title, items }) => (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button variant="ghost" onClick={() => items.forEach(addToCart)}>Добавить всё</Button>
      </div>
      <div className="grid gap-3">
        {items.map((p) => (
          <div key={`${p.timeOfDay}-${p.step}-${p.name}`} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3">
            <div>
              <div className="text-base font-medium">{p.name}</div>
              <div className="text-xs opacity-60">{p.step}</div>
            </div>
            <Button size="sm" onClick={() => addToCart(p)}>Добавить в корзину</Button>
          </div>
        ))}
      </div>
    </Card>
  );

  const HeaderBar = () => (
    <div className="flex items-center justify-between mb-5">
      <div className="text-2xl md:text-3xl font-bold">Мой план ухода</div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate("/cart")}>Корзина</Button>
        <Button variant="ghost" onClick={exportToTelegram}>Отправить в чат</Button>
        <Button onClick={exportToPDF}>Скачать PDF</Button>
      </div>
    </div>
  );

  const MetricsBlock = () => (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold">Skin-характеристики</h3>
        <div className="text-sm text-neutral-500">Базируется на ваших ответах</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Тип кожи</div>
          <div className="text-lg font-semibold">{metrics.skinType}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-2">Чувствительность</div>
          <div className="flex items-center gap-3">
            <div className="w-full"><Progress value={metrics.sensitivity ? 70 : 30} /></div>
            <div className="text-sm font-medium w-8 text-right">{metrics.sensitivity ? 9 : 3}</div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-2">Жирность</div>
          <div className="flex items-center gap-3">
            <div className="w-full"><Progress value={metrics.oiliness === "высокая" ? 85 : metrics.oiliness === "средняя" ? 55 : 25} /></div>
            <div className="text-sm font-medium w-12 text-right">{metrics.oiliness}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Основная цель</div>
          <div className="font-medium">{metrics.primaryGoal}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Ключевые активы</div>
          <div className="text-sm text-neutral-700">{metrics.recommendedActives.slice(0, 3).join(", ")}</div>
        </div>
      </div>
    </Card>
  );

  const Days28Block = () => (
    <Card className="p-4 md:p-5">
      <h3 className="text-xl font-semibold mb-3">Расписание 28 дней</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schedule28.map((d) => (
          <div key={d.day} className="rounded-xl border border-neutral-200 p-3">
            <div className="text-sm font-semibold mb-1">День {d.day}</div>
            <div className="text-sm"><span className="opacity-60">Утро:</span> {d.morningNotes.join("; ")}</div>
            <div className="text-sm"><span className="opacity-60">Вечер:</span> {d.eveningNotes.join("; ")}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const CorePlan = (
    <div className="space-y-4">
      <MetricsBlock />
      <ProductsBlock title="Утро" items={plan.morning} />
      <ProductsBlock title="Вечер" items={plan.evening} />
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm opacity-70">Быстро добавить все средства в корзину</div>
          <Button onClick={addAllToCart}>Добавить все</Button>
        </div>
      </Card>
      <Days28Block />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 md:py-8 print:px-0">
      <HeaderBar />

      {/* Если не оплачено — показываем заблюренный план с CTA; если оплачено — обычный контент */}
      {!paid ? <Blurred>{CorePlan}</Blurred> : CorePlan}

      {/* Подсказка для печати/экспорта */}
      <style>{`
        @media print {
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          button, a { display: none !important; }
          .blur-md { filter: none !important; }
          .backdrop-blur-sm, .bg-white\\/70 { display: none !important; }
        }
      `}</style>
    </div>
  );
}

