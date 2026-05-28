// lib/db-request-scope.ts
// Per-request scope для Prisma в Cloudflare Workers.
//
// Проблема: PrismaClient в CF Workers нельзя кешировать на globalThis между
// запросами — Neon-адаптер держит fetch-state, привязанный к request-context
// первого запроса. Конкурентные запросы в одном изоляте видят чужой клиент и
// получают "Cannot perform I/O on behalf of a different request" → 500/таймауты/
// обрезанные ответы. Глобальная переменная reqId НЕ изолирует по запросу:
// globalThis в CF Workers общий для всех конкурентных запросов изолята, и более
// поздний request перетирал reqId, ломая ещё не завершившийся ранний handler.
//
// Решение: AsyncLocalStorage. CF Workers (nodejs_compat_v2) инициализирует свежий
// async-контекст на каждый fetch event, а enterWith() прокидывает значение по
// всему async-дереву ЭТОГО запроса. Конкурентные запросы в одном изоляте видят
// независимые сторы.
//
// Тонкий модуль БЕЗ зависимостей на @prisma/* — безопасно импортится из
// middleware.ts (Edge Runtime под CF Workers с nodejs_compat_v2).

import { AsyncLocalStorage } from 'node:async_hooks';

// Тип клиента НЕ импортируем (это притянуло бы @prisma/* в middleware).
// lib/db.ts кладёт сюда свой PrismaClient через прозрачный контейнер.
export interface PrismaScope {
  client?: unknown;
}

const storage = new AsyncLocalStorage<PrismaScope>();

/**
 * Вызывается middleware'ом в начале каждого request handler-а.
 * Создаёт свежий стор для текущего async-контекста. Все async-операции,
 * запущенные после этого вызова в той же цепочке, увидят этот стор.
 */
export function resetPrismaForRequest(): void {
  storage.enterWith({});
}

/**
 * Возвращает per-request scope. Если middleware не успел его поставить
 * (Node-скрипты, cron без middleware, или оборвавшийся async-контекст) —
 * лениво инициализирует свежий стор для текущей async-цепочки.
 *
 * Гарантия: внутри одного route handler-а все вызовы возвращают один и тот же
 * объект scope (через ALS), поэтому Prisma-клиент в нём шарится между всеми
 * prisma.X.Y вызовами одного запроса.
 */
export function getPrismaScope(): PrismaScope {
  let scope = storage.getStore();
  if (!scope) {
    scope = {};
    storage.enterWith(scope);
  }
  return scope;
}
