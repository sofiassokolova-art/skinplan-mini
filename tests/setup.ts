// tests/setup.ts
// Настройка окружения для тестов

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { injectAppPrismaOverTcp } from './helpers/prisma-test-client';

// DB-интеграционные прогоны против удалённого Neon (staging/prod): app-клиент
// из @/lib/db использует Neon HTTP fetch, который с локальной сети не может
// стартовать interactive transaction (P2028 в /api/questionnaire/answers).
// Подменяем его на pg TCP через globalThis.__prisma (getPrisma() переиспользует).
// Без DATABASE_URL (обычный локальный прогон) — no-op.
injectAppPrismaOverTcp();

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

if (typeof window !== 'undefined') {
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
}
