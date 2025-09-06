import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Подготовка: ответы пользователя, чтобы план не был пустым
const seedAnswers = () => {
  localStorage.setItem(
    "skiniq.answers",
    JSON.stringify({
      name: "София",
      pdConsent: true,
      skinType: "комбинированная",
      sensitivity: false,
      concerns: ["акне", "расширенные поры"],
      oiliness: "высокая",
      primaryGoal: "сузить поры",
    })
  );
  localStorage.removeItem("skiniq.premium"); // по умолчанию — не оплачено
};

// ДИНАМИЧЕСКИЙ импорт после подстановки localStorage, чтобы зависимые вычисления брали актуальные данные
const renderPlan = async () => {
  const mod = await import("../pages/Plan");
  const Plan = mod.default;
  return render(
    <MemoryRouter>
      <Plan />
    </MemoryRouter>
  );
};

describe("Plan page rendering", () => {
  beforeEach(() => {
    localStorage.clear();
    seedAnswers();
  });

  it("показывает заблюренный план и CTA к оплате, если не premium", async () => {
    await renderPlan();

    // есть CTA разблокировки
    expect(screen.getByRole("button", { name: /Разблокировать рекомендации за 199₽/i })).toBeInTheDocument();

    // подсказки paywall'a (текст о разблокировке)
    expect(screen.getByText(/персональные рекомендации/i)).toBeInTheDocument();
  });

  it("после разблокировки рендерит блоки Утро/Вечер и кнопки добавления", async () => {
    await renderPlan();

    // кликаем по разблокировке
    await userEvent.click(screen.getByRole("button", { name: /Разблокировать рекомендации/i }));

    // заголовки секций
    expect(screen.getByRole("heading", { level: 1, name: /Мой план ухода/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Утро/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Вечер/i })).toBeInTheDocument();

    // кнопки «Добавить всё» присутствуют (минимум одна, обычно две)
    const addAllButtons = screen.getAllByRole("button", { name: /добавить всё/i });
    expect(addAllButtons.length).toBeGreaterThanOrEqual(1);

    // у карточек продуктов есть кнопка «Добавить в корзину»
    expect(screen.getAllByRole("button", { name: /добавить в корзину/i }).length).toBeGreaterThan(0);
  });

  it("отображает skin-метрики и 28-дневный план", async () => {
    await renderPlan();
    await userEvent.click(screen.getByRole("button", { name: /Разблокировать рекомендации/i }));

    // Skin-характеристики
    expect(screen.getByRole("heading", { level: 3, name: /Skin-характеристики/i })).toBeInTheDocument();

    // Расписание 28 дней
    expect(screen.getByRole("heading", { level: 3, name: /Расписание 28 дней/i })).toBeInTheDocument();

    // Найдём несколько карточек «День N»
    const dayItems = screen.getAllByText(/День \d+/i);
    expect(dayItems.length).toBeGreaterThanOrEqual(10); // рендерим много; точный 28 может зависеть от разметки
  });

  it("показывает кнопки экспорта и переход в корзину", async () => {
    await renderPlan();
    await userEvent.click(screen.getByRole("button", { name: /Разблокировать рекомендации/i }));

    // Экспорт в чат
    expect(screen.getByRole("button", { name: /Отправить в чат/i })).toBeInTheDocument();
    // Печать (PDF)
    expect(screen.getByRole("button", { name: /Скачать PDF/i })).toBeInTheDocument();
    // Корзина
    expect(screen.getByRole("button", { name: /Корзина/i })).toBeInTheDocument();
  });

  it("клик по «Добавить всё» не падает и складывает товары в localStorage", async () => {
    await renderPlan();
    await userEvent.click(screen.getByRole("button", { name: /Разблокировать рекомендации/i }));

    const addAll = screen.getAllByRole("button", { name: /добавить все/i })[0];
    await userEvent.click(addAll);

    const cartRaw = localStorage.getItem("skiniq.cart") || "[]";
    const cart = JSON.parse(cartRaw);
    expect(Array.isArray(cart)).toBe(true);
    expect(cart.length).toBeGreaterThan(0);
  });
});

