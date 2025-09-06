// src/lib/storage.ts

// ===== Типы =====
export type Answers = {
  userName?: string;
  skinType?: string;              // "Сухая" | "Нормальная" | "Комбинированная" | "Жирная"
  sensitivity?: number;           // 0..10
  goals?: string[];               // ["Покраснение", "Ровный тон/сияние", ...]
  amTime?: string;                // для метрик-виджета (необязательно)
  pmTime?: string;
  sunLoad?: number;               // 0..100
  [key: string]: any;
};

export type CartItem = {
  productId: string;
  count: number;
  note?: string;
};

export type Cart = CartItem[];

// ===== Ключи хранилища =====
const AKEY = "skiniq_answers_v1";
const CKEY = "skiniq_cart_v1";

// ===== Утилиты =====
function safeJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ===== Анкета =====
export function loadAnswers(): Answers | null {
  return safeJSON<Answers>(localStorage.getItem(AKEY));
}
export function saveAnswers(a: Answers): void {
  localStorage.setItem(AKEY, JSON.stringify(a ?? {}));
}
export function hasAnswers(): boolean {
  return !!loadAnswers();
}
export function getUserName(): string | undefined {
  return loadAnswers()?.userName;
}

// ===== Корзина =====
export function loadCart(): Cart {
  return safeJSON<Cart>(localStorage.getItem(CKEY)) ?? [];
}
export function saveCart(cart: Cart): void {
  localStorage.setItem(CKEY, JSON.stringify(cart ?? []));
}
export function clearCart(): void {
  localStorage.removeItem(CKEY);
}

