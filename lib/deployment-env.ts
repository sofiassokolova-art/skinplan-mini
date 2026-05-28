// lib/deployment-env.ts
// Единая проверка production-деплоя (Cloudflare Workers / Pages / Node)

/**
 * Production-деплой ТОЛЬКО при явном маркере:
 *  - DEPLOYMENT_ENV === 'production' (CF Workers: задаётся в [env.production.vars] в wrangler.toml)
 *  - либо CF_PAGES_BRANCH === 'main' (legacy CF Pages)
 *
 * Всё остальное (staging, preview, local dev, отсутствующие маркеры) — НЕ прод.
 * Fallback на NODE_ENV=production убран намеренно: в собранном worker'е
 * NODE_ENV всегда 'production', и без явного DEPLOYMENT_ENV staging-воркер
 * ошибочно считался продом.
 */
export function isProductionDeployment(): boolean {
  if (process.env.DEPLOYMENT_ENV === 'production') return true;
  if (process.env.CF_PAGES_BRANCH === 'main') return true;
  return false;
}

/**
 * Явный маркер НЕ-прод окружения. Используется для разрешения тестового
 * Telegram initData и платёжного симулятора.
 *
 * FAIL-CLOSED: при отсутствующем/неизвестном маркере возвращаем false — то есть
 * тестовые креды и симулятор НЕ включаются. Раньше эта проверка была
 * `!isProductionDeployment()`, из-за чего любой мисконфиг прод-воркера
 * (потерянный/неустановленный DEPLOYMENT_ENV) открывал приём поддельного
 * initData (захват любого аккаунта) и бесплатный доступ через симулятор.
 *
 * Теперь не-прод включается только при ЯВНОМ сигнале:
 *  - DEPLOYMENT_ENV ∈ {staging, preview, development}
 *  - NODE_ENV === 'development' (локальный next dev)
 *  - ALLOW_TEST_INIT_DATA === 'true' (явный opt-in для e2e/preview)
 *  - CF_PAGES_BRANCH задан и ≠ 'main' (legacy CF Pages preview)
 */
export function isExplicitNonProd(): boolean {
  // Прод всегда побеждает — даже если случайно выставлены оба маркера.
  if (isProductionDeployment()) return false;

  const env = process.env.DEPLOYMENT_ENV;
  if (env === 'staging' || env === 'preview' || env === 'development') return true;

  if (process.env.NODE_ENV === 'development') return true;

  if (process.env.ALLOW_TEST_INIT_DATA === 'true') return true;

  const cfBranch = process.env.CF_PAGES_BRANCH;
  if (cfBranch && cfBranch !== 'main') return true;

  return false;
}

/**
 * Тестовый Telegram initData — только в ЯВНО не-прод окружении (fail-closed).
 * Неизвестный/отсутствующий маркер окружения => false (поддельный initData отклоняется).
 */
export function allowTestTelegramInitData(): boolean {
  return isExplicitNonProd();
}
