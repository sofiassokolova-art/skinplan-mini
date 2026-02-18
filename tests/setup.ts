// tests/setup.ts
// Настройка окружения для тестов

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Очистка после каждого теста
afterEach(() => {
  cleanup();
});

// Моки для Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Моки для window.Telegram
Object.defineProperty(window, 'Telegram', {
  writable: true,
  value: {
    WebApp: {
      initData: 'test_init_data',
      ready: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
    },
  },
});

// Моки для sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});
