// lib/deployment-env.ts
// Единая проверка production-деплоя (Cloudflare Pages / Node)

/** Production = ветка main на CF Pages или NODE_ENV=production без ветки */
export function isProductionDeployment(): boolean {
  const cfBranch = process.env.CF_PAGES_BRANCH;
  return cfBranch === 'main' || (!cfBranch && process.env.NODE_ENV === 'production');
}

/** Тестовый Telegram initData (локально / staging / preview) */
export function allowTestTelegramInitData(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.ALLOW_TEST_INIT_DATA === 'true') return true;
  return !isProductionDeployment();
}
