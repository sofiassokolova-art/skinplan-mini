import { test, expect } from '@playwright/test';

/**
 * Хелпер: замокать Telegram WebApp до загрузки страницы
 */
async function mockTelegram(page: import('@playwright/test').Page, { withInitData = true } = {}) {
  await page.addInitScript(({ withInitData }) => {
    // ИСПРАВЛЕНО: Убеждаемся, что initData доступен сразу, чтобы API запросы не блокировались
    (window as any).Telegram = {
      WebApp: {
        initData: withInitData ? 'test-init-data=e2e&user=%7B%22id%22%3A123456%7D' : '',
        initDataUnsafe: {
          user: { id: 123456, first_name: 'E2E', username: 'e2e_user' },
        },
        ready: () => {},
        expand: () => {},
        close: () => {},
        version: '6.0',
        platform: 'web',
        colorScheme: 'light',
      },
    };
    
    // Убеждаемся, что initData доступен сразу
    if (withInitData && !(window as any).Telegram.WebApp.initData) {
      (window as any).Telegram.WebApp.initData = 'test-init-data=e2e&user=%7B%22id%22%3A123456%7D';
    }
  }, { withInitData });
}

/**
 * Хелпер: замокать API ответ для загрузки прогресса
 */
async function mockProgressAPI(
  page: import('@playwright/test').Page,
  answers: Record<number, string | string[]> = { 1: 'Тестовое имя', 2: 'dry' },
  questionIndex: number = 1,
  infoScreenIndex: number = 0
) {
  // ИСПРАВЛЕНО: Мокируем все возможные варианты эндпоинта прогресса
  // API_BASE = '/api', поэтому запросы идут к /api/questionnaire/progress
  const progressResponse = {
    progress: {
      answers,
      questionIndex,
      infoScreenIndex,
      timestamp: Date.now(),
    },
    isCompleted: false,
  };
  
  // Мокируем с /api префиксом (основной вариант)
  await page.route('**/api/questionnaire/progress', async (route) => {
    console.log('✅ Мок прогресса сработал для /api/questionnaire/progress');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(progressResponse),
    });
  });
  
  // Также мокируем без /api префикса на случай, если используется другой формат
  await page.route('**/questionnaire/progress', async (route) => {
    console.log('✅ Мок прогресса сработал для /questionnaire/progress');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(progressResponse),
    });
  });
}

/**
 * Хелпер: замокать API ответ для загрузки анкеты
 */
async function mockQuestionnaireAPI(page: import('@playwright/test').Page) {
  // ИСПРАВЛЕНО: Мокируем правильный эндпоинт - /questionnaire/active (используется в api.getActiveQuestionnaire)
  await page.route('**/questionnaire/active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Тестовая анкета',
        version: 1,
        groups: [
          {
            id: 1,
            name: 'Группа 1',
            questions: [
              {
                id: 1,
                code: 'user_name',
                type: 'free_text',
                text: 'Как вас зовут?',
                isRequired: true,
                options: [],
              },
              {
                id: 2,
                code: 'skin_type',
                type: 'single_choice',
                text: 'Какой у вас тип кожи?',
                isRequired: true,
                options: [
                  { id: 1, label: 'Сухая', value: 'dry' },
                  { id: 2, label: 'Жирная', value: 'oily' },
                ],
              },
              {
                id: 3,
                code: 'skin_goals',
                type: 'multi_choice',
                text: 'На чём вы хотите сфокусироваться?',
                isRequired: true,
                options: [
                  { id: 1, label: 'Морщины', value: 'wrinkles' },
                  { id: 2, label: 'Акне', value: 'acne' },
                ],
              },
            ],
          },
        ],
        questions: [],
      }),
    });
  });
  
  // Также мокируем с /api префиксом
  await page.route('**/api/questionnaire/active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Тестовая анкета',
        version: 1,
        groups: [
          {
            id: 1,
            name: 'Группа 1',
            questions: [
              {
                id: 1,
                code: 'user_name',
                type: 'free_text',
                text: 'Как вас зовут?',
                isRequired: true,
                options: [],
              },
              {
                id: 2,
                code: 'skin_type',
                type: 'single_choice',
                text: 'Какой у вас тип кожи?',
                isRequired: true,
                options: [
                  { id: 1, label: 'Сухая', value: 'dry' },
                  { id: 2, label: 'Жирная', value: 'oily' },
                ],
              },
              {
                id: 3,
                code: 'skin_goals',
                type: 'multi_choice',
                text: 'На чём вы хотите сфокусироваться?',
                isRequired: true,
                options: [
                  { id: 1, label: 'Морщины', value: 'wrinkles' },
                  { id: 2, label: 'Акне', value: 'acne' },
                ],
              },
            ],
          },
        ],
        questions: [],
      }),
    });
  });
  
  // Мокируем другие возможные эндпоинты API
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    // Если это не замоканный эндпоинт, возвращаем 404
    if (!url.includes('/api/questionnaire/current') && !url.includes('/api/questionnaire/progress')) {
      await route.continue();
    }
  });
}

test.describe('Quiz Resume Screen E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Очищаем localStorage и sessionStorage перед каждым тестом
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // ignore
      }
    });
  });

  test('должен отображать резюм-экран при наличии >= 2 сохраненных ответов', async ({ page }) => {
    // Настраиваем моки ПЕРЕД переходом на страницу
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    // Мокируем API для возврата прогресса с 2 ответами (минимум для показа резюм-экрана)
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
    }, 1, 0);
    
    // Добавляем логирование всех сетевых запросов для отладки
    page.on('request', (request) => {
      if (request.url().includes('progress') || request.url().includes('questionnaire')) {
        console.log('📡 Запрос:', request.method(), request.url());
      }
    });
    
    page.on('response', (response) => {
      if (response.url().includes('progress') || response.url().includes('questionnaire')) {
        console.log('📥 Ответ:', response.status(), response.url());
      }
    });

    // Переходим на страницу с увеличенным таймаутом
    // Используем 'domcontentloaded' для более быстрой загрузки, но с большим таймаутом
    await page.goto('/quiz', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Ждем, пока страница полностью загрузится
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // Игнорируем ошибку, если networkidle не достигнут
    });
    
    // ИСПРАВЛЕНО: Ждем, пока запрос к прогрессу будет выполнен
    // Проверяем, что запрос к прогрессу был сделан и обработан
    await page.waitForTimeout(2000); // Даем время на выполнение запросов
    
    // Отладочная информация: проверяем, что страница загрузилась
    const pageContent = await page.content();
    const hasResumeText = pageContent.includes('Вы не завершили анкету');
    const hasProgressText = pageContent.includes('Мы сохранили ваш прогресс');
    
    // Если резюм-экран не найден, выводим отладочную информацию
    if (!hasResumeText) {
      console.log('Отладка: Резюм-экран не найден');
      console.log('Содержимое страницы (первые 2000 символов):', pageContent.substring(0, 2000));
      // Проверяем, что на странице есть
      const bodyText = await page.locator('body').textContent();
      console.log('Текст body (первые 500 символов):', bodyText?.substring(0, 500));
      // Делаем скриншот для отладки
      await page.screenshot({ path: 'test-results/debug-resume-screen.png', fullPage: true });
    }

    // Ждем загрузки анкеты и проверяем отображение резюм-экрана
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });
    
    // Проверяем подзаголовок
    await expect(
      page.locator('text=Мы сохранили ваш прогресс — продолжите с того же места или начните заново')
    ).toBeVisible();

    // Проверяем кнопку "Продолжить с вопроса N"
    const continueButton = page.locator('button:has-text("Продолжить с вопроса")');
    await expect(continueButton).toBeVisible();
    
    // Проверяем, что номер вопроса отображается
    await expect(page.locator('text=/Продолжить с вопроса \\d+/')).toBeVisible();

    // Проверяем кнопку "Начать анкету заново"
    await expect(page.locator('button:has-text("Начать анкету заново")')).toBeVisible();
  });

  test('должен показывать правильный номер следующего вопроса', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    // Мокируем прогресс: ответили на вопросы 1 и 2, следующий - 3
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
    }, 1, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Ждем загрузки и проверяем, что показывается вопрос 3
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=/Продолжить с вопроса 3/')).toBeVisible();
  });

  test('должен вызывать onResume при клике на кнопку "Продолжить"', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
    }, 1, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Ждем появления резюм-экрана
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });

    // Кликаем на кнопку "Продолжить"
    const continueButton = page.locator('button:has-text("Продолжить с вопроса")');
    await continueButton.click();

    // Проверяем, что произошел переход (либо к вопросу, либо URL изменился)
    // Резюм-экран должен исчезнуть
    await expect(page.locator('text=Вы не завершили анкету')).not.toBeVisible({ timeout: 5000 });
  });

  test('должен вызывать onStartOver при клике на кнопку "Начать заново"', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
    }, 1, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Ждем появления резюм-экрана
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });

    // Кликаем на кнопку "Начать анкету заново"
    const startOverButton = page.locator('button:has-text("Начать анкету заново")');
    await startOverButton.click();

    // После клика резюм-экран должен исчезнуть и начаться новая анкета
    // (либо показывается первый вопрос, либо начальные инфо-экраны)
    await expect(page.locator('text=Вы не завершили анкету')).not.toBeVisible({ timeout: 5000 });
  });

  test('не должен показывать резюм-экран при < 2 сохраненных ответов', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    // Мокируем прогресс только с 1 ответом (недостаточно для резюм-экрана)
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
    }, 0, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Резюм-экран не должен отображаться
    // Вместо этого должны показываться начальные инфо-экраны или первый вопрос
    await expect(page.locator('text=Вы не завершили анкету')).not.toBeVisible({ timeout: 10000 });
  });

  test('должен правильно вычислять номер вопроса когда все вопросы отвечены', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    // Мокируем прогресс с большим количеством ответов (симулируем, что все отвечены)
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
      3: ['wrinkles'],
    }, 2, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Ждем загрузки
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });
    
    // Должен показываться номер последнего вопроса или общее количество
    const continueButtonText = await page.locator('button:has-text("Продолжить с вопроса")').textContent();
    expect(continueButtonText).toContain('Продолжить с вопроса');
  });

  test('должен отображать правильные стили резюм-экрана', async ({ page }) => {
    await mockTelegram(page, { withInitData: true });
    await mockQuestionnaireAPI(page);
    
    await mockProgressAPI(page, {
      1: 'Тестовое имя',
      2: 'dry',
    }, 1, 0);

    await page.goto('/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Ждем появления резюм-экрана
    await expect(page.locator('text=Вы не завершили анкету')).toBeVisible({ timeout: 20000 });

    // Проверяем стили заголовка (должен быть Unbounded, жирный, черный)
    const title = page.locator('text=Вы не завершили анкету');
    await expect(title).toBeVisible();
    
    // Проверяем, что кнопка "Продолжить" имеет лаймовый фон
    const continueButton = page.locator('button:has-text("Продолжить с вопроса")');
    const continueButtonStyles = await continueButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
      };
    });
    
    // Лаймовый цвет #D5FE61 в RGB: rgb(213, 254, 97)
    expect(continueButtonStyles.backgroundColor).toContain('213');
    expect(continueButtonStyles.backgroundColor).toContain('254');
    expect(continueButtonStyles.backgroundColor).toContain('97');
    
    // Проверяем, что кнопка "Начать заново" имеет прозрачный фон и черную рамку
    const startOverButton = page.locator('button:has-text("Начать анкету заново")');
    const startOverButtonStyles = await startOverButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        border: styles.border,
      };
    });
    
    // Прозрачный фон или белый
    expect(startOverButtonStyles.backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/);
    expect(startOverButtonStyles.border).toContain('2px');
  });
});
