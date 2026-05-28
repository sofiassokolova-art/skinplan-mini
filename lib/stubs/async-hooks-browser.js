// lib/stubs/async-hooks-browser.js
// Browser/no-op стаб для node:async_hooks.
//
// Клиентский бандл НЕ выполняет ALS-пути (DB-операции — серверные), но webpack
// обязан зарезолвить node:-схему в статическом графе:
//   page.tsx → lib/logger.ts (await import('@/lib/db')) → lib/db.ts → lib/db-request-scope.ts
// На клиенте node:async_hooks не существует → UnhandledSchemeError. Этот стаб
// подменяет его no-op реализацией только в client-бандле (см. next.config.mjs,
// NormalModuleReplacementPlugin при !isServer). На сервере (nodejs) и edge
// используется настоящий node:async_hooks.

export class AsyncLocalStorage {
  getStore() {
    return undefined;
  }
  enterWith() {}
  run(_store, callback, ...args) {
    return callback(...args);
  }
  exit(callback, ...args) {
    return callback(...args);
  }
  disable() {}
}

export default { AsyncLocalStorage };
