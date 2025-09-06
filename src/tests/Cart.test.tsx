// src/tests/Cart.test.tsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Мокаем роутер (навигацию)
const navigateMock = vi.fn();
vi.mock("react-router-dom", () => {
  return {
    useNavigate: () => navigateMock,
    MemoryRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Хелперы
const CART_KEY = "skiniq.cart";
const seedCart = (items: any[]) =>
  localStorage.setItem(CART_KEY, JSON.stringify(items));

const renderCart = async () => {
  const mod = await import("../pages/Cart");
  const Cart = mod.default;
  return render(<Cart />);
};

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
});

describe("Cart page", () => {
  it("показывает пустое состояние и CTA «Перейти к плану»", async () => {
    await renderCart();

    expect(screen.getByRole("heading", { level: 1, name: /корзина/i })).toBeInTheDocument();
    expect(screen.getByText(/пока тут пусто/i)).toBeInTheDocument();

    const toPlan = screen.getByRole("button", { name: /перейти к плану/i });
    await userEvent.click(toPlan);
    expect(navigateMock).toHaveBeenCalledWith("/plan");
  });

  it("рендерит карточки добавленных товаров (название, время, кнопки «Купить»)", async () => {
    seedCart([
      {
        name: "Гель-очищение X",
        step: "cleanser",
        timeOfDay: "morning",
        url: "https://brand.example/product-x",
      },
      {
        name: "BHA 2% Y",
        step: "treatment",
        timeOfDay: "evening",
      },
    ]);
    await renderCart();

    // названия
    expect(screen.getByText("Гель-очищение X")).toBeInTheDocument();
    expect(screen.getByText("BHA 2% Y")).toBeInTheDocument();

    // время суток (Утро/Вечер)
    expect(screen.getAllByText(/утро/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/вечер/i).length).toBeGreaterThan(0);

    // у первого — прямая ссылка «Купить»
    const directBuy = screen.getByRole("link", { name: /купить$/i });
    expect(directBuy).toHaveAttribute("href", "https://brand.example/product-x");

    // у второго — маркетплейсы
    expect(screen.getByRole("link", { name: /купить на ozon/i })).toHaveAttribute(
      "href",
      expect.stringContaining("ozon.ru")
    );
    expect(screen.getByRole("link", { name: /купить на wb/i })).toHaveAttribute(
      "href",
      expect.stringContaining("wildberries.ru")
    );
    expect(screen.getByRole("link", { name: /поиск в google/i })).toHaveAttribute(
      "href",
      expect.stringContaining("google.com/search")
    );
  });

  it("удаляет товар по клику на «Удалить»", async () => {
    seedCart([
      { name: "SPF 50 Z", step: "spf", timeOfDay: "morning" },
      { name: "Крем с керамидами", step: "moisturizer", timeOfDay: "evening" },
    ]);
    await renderCart();

    // два товара изначально
    expect(screen.getByText(/spf 50 z/i)).toBeInTheDocument();
    expect(screen.getByText(/крем с керамидами/i)).toBeInTheDocument();

    // жмём первый «Удалить»
    const removeBtns = screen.getAllByRole("button", { name: /удалить/i });
    await userEvent.click(removeBtns[0]);

    await waitFor(() => {
      expect(screen.queryByText(/spf 50 z/i)).not.toBeInTheDocument();
    });

    // localStorage реально обновился
    const arr = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    expect(arr.length).toBe(1);
    expect(arr[0].name).toMatch(/крем/i);
  });

  it("очищает корзину целиком и показывает пустое состояние", async () => {
    seedCart([
      { name: "Тонер A", step: "toner", timeOfDay: "morning" },
      { name: "Азелаиновая 10%", step: "treatment", timeOfDay: "evening" },
    ]);
    await renderCart();

    // верхняя кнопка «Очистить корзину»
    const clearBtn = screen.getAllByRole("button", { name: /очистить корзину/i })[0];
    await userEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText(/пока тут пусто/i)).toBeInTheDocument();
    });

    const arr = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    expect(arr.length).toBe(0);
  });

  it("навигация «Вернуться к плану» и «Добавить ещё» ведёт в /plan", async () => {
    seedCart([{ name: "Гель-очищение X", step: "cleanser", timeOfDay: "morning" }]);
    await renderCart();

    const backTop = screen.getByRole("button", { name: /вернуться к плану/i });
    await userEvent.click(backTop);
    expect(navigateMock).toHaveBeenCalledWith("/plan");

    const addMore = screen.getByRole("button", { name: /добавить ещё/i });
    await userEvent.click(addMore);
    expect(navigateMock).toHaveBeenCalledWith("/plan");
  });
});

