// lib/db-request-scope.ts
// Тонкий модуль БЕЗ зависимостей на @prisma/* — можно безопасно
// импортить из middleware.ts (Edge Runtime).
//
// PrismaClient в CF Workers нельзя кешировать между запросами:
// его внутренний fetch-pool привязан к request-context первого вызова,
// последующие запросы получают "Cannot perform I/O on behalf of a different request".
// Решение: сбрасывать кэш в начале КАЖДОГО request handler-а.
//
// Сам кэш лежит в lib/db.ts; здесь только функция reset, которую дёргает middleware.

const REQ_ID_KEY = Symbol.for('skiniq.prismaRequestId');
const store = globalThis as unknown as { [REQ_ID_KEY]?: string };

export function resetPrismaForRequest(): void {
  store[REQ_ID_KEY] = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function currentPrismaRequestId(): string {
  return store[REQ_ID_KEY] || '';
}
