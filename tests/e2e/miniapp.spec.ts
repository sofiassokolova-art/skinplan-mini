import { test, expect } from '@playwright/test';

/**
 * Хелпер: замокать Telegram WebApp до загрузки страницы
 */
async function mockTelegram(page: import('@playwright/test').Page, { withInitData = true } = {}) {
  await page.addInitScript(({ withInitData }) => {
    (window as any).Telegram = {
      WebApp: {
        initData: withInitData ? 'test-init-data=e2e' : '',
        initDataUnsafe: {
          user: { id: 123456, first_name: 'E2E', username: 'e2e_user' },
        },
      },
    };
  }, { withInitData });
}

test.describe('Miniapp basic flows (Telegram / оплата / план)', () => {
  test('1. Новый пользователь, вход не из Telegram → редирект/CTA к анкете', async ({ page }) => {
    await page.goto('/');

    // Либо сразу редирект на /quiz, либо экран CTA "Создайте свой план ухода"
    const url = page.url();
    if (url.includes('/quiz')) {
      await expect(page.locator('text=Пройти анкету')).toBeVisible();
    } else {
      await expect(page.locator('text=Создайте свой план ухода')).toBeVisible();
    }
  });

  test('2. Главная с Telegram initData → не падает, показывает заголовок и CTA плана', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await page.goto('/');

    await expect(page.locator('text=Время заботиться о своей коже')).toBeVisible();
    await expect(page.locator('text=28-дневный план')).toBeVisible();
  });

  test('3. План: страница открывается, есть календарь и DayView внутри PaymentGate', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await page.goto('/plan');

    // Календарь на 28 дней
    await expect(page.locator('text=План на 28 дней')).toBeVisible();

    // DayView: заголовок "День" и утро/вечер
    await expect(page.locator('text=День')).toBeVisible();
    await expect(page.locator('text=Утро')).toBeVisible();
    await expect(page.locator('text=Вечер')).toBeVisible();
  });

  test('4. PaymentGate: при отсутствии оплаты контент заблюрен и есть CTA оплаты', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });

    // Чистим локальные флаги оплаты перед заходом
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('payment_first_completed');
        localStorage.removeItem('payment_retaking_completed');
      } catch {
        // ignore
      }
    });

    await page.goto('/plan');

    // Проверяем, что есть текст про оплату
    await expect(
      page.locator('text=Получите полный доступ к плану').or(
        page.locator('text=Обновите доступ к плану'),
      ),
    ).toBeVisible();

    await expect(page.locator('text=Оплатить')).toBeVisible();
  });

  test('5. PaymentGate: при выставленном флаге оплаты в localStorage нет CTA оплаты', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });

    // Ставим локальный флаг "оплачено"
    await page.addInitScript(() => {
      try {
        localStorage.setItem('payment_first_completed', 'true');
      } catch {
        // ignore
      }
    });

    await page.goto('/plan');

    // Текст попапа оплаты не должен отображаться
    await expect(
      page.locator('text=Получите полный доступ к плану').or(
        page.locator('text=Обновите доступ к плану'),
      ),
    ).toHaveCount(0);
  });

  test('6. Профиль: без Telegram initData показывается сообщение об открытии через Mini App', async ({ page }) => {
    await page.goto('/profile');

    await expect(
      page.locator('text=Откройте приложение через Telegram Mini App'),
    ).toBeVisible();
  });

  test('7. Профиль: c Telegram initData грузится профиль / план без краша', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await page.goto('/profile');

    // Проверяем, что нет экрана "Откройте через Telegram Mini App"
    await expect(
      page.locator('text=Откройте приложение через Telegram Mini App'),
    ).toHaveCount(0);

    // И что есть какой‑то основной контент личного кабинета
    await expect(
      page.locator('text=Ваш план ухода').or(page.locator('text=Личный кабинет')),
    ).toBeVisible();
  });
}


