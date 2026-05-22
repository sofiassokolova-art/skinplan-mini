// lib/deployment-env.ts
// Единая проверка production-деплоя (Cloudflare Workers / Pages / Node)

/**
 * Production-деплой, если:
 *  - DEPLOYMENT_ENV === 'production' (CF Workers: задаётся в [env.production.vars] в wrangler.toml)
 *  - CF_PAGES_BRANCH === 'main' (legacy CF Pages)
 *  - либо NODE_ENV=production без явных маркеров деплоя (fail-safe для прода)
 *
 * Staging явно помечается DEPLOYMENT_ENV === 'staging' — тогда возвращаем false,
 * чтобы включить симулятор оплаты вместо ЮKassa.
 */
export function isProductionDeployment(): boolean {
  const deployEnv = process.env.DEPLOYMENT_ENV;
  if (deployEnv === 'production') return true;
  if (deployEnv === 'staging') return false;

  const cfBranch = process.env.CF_PAGES_BRANCH;
  return cfBranch === 'main' || (!cfBranch && process.env.NODE_ENV === 'production');
}

/** Тестовый Telegram initData (локально / staging / preview) */
export function allowTestTelegramInitData(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.ALLOW_TEST_INIT_DATA === 'true') return true;
  return !isProductionDeployment();
}
