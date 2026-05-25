// lib/deployment-env.ts
// Единая проверка production-деплоя (Cloudflare Workers / Pages / Node)

/**
 * Production-деплой ТОЛЬКО при явном маркере:
 *  - DEPLOYMENT_ENV === 'production' (CF Workers: задаётся в [env.production.vars] в wrangler.toml)
 *  - либо CF_PAGES_BRANCH === 'main' (legacy CF Pages)
 *
 * Всё остальное (staging, preview, local dev, отсутствующие маркеры) — НЕ прод,
 * включается симулятор оплаты вместо ЮKassa. Fallback на NODE_ENV=production
 * убран намеренно: в собранном worker'е NODE_ENV всегда 'production', и без явного
 * DEPLOYMENT_ENV staging-воркер ошибочно считался продом.
 */
export function isProductionDeployment(): boolean {
  if (process.env.DEPLOYMENT_ENV === 'production') return true;
  if (process.env.CF_PAGES_BRANCH === 'main') return true;
  return false;
}

/** Тестовый Telegram initData (локально / staging / preview) */
export function allowTestTelegramInitData(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.ALLOW_TEST_INIT_DATA === 'true') return true;
  return !isProductionDeployment();
}
