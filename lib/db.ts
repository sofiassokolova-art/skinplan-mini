// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)
// Использует @prisma/adapter-neon для совместимости с Cloudflare Workers/Pages

// Импортируем основной entry Prisma Client: generated package сам выбирает
// Node index.js в локальном Next dev и wasm.js в workerd/edge через conditions.
// Прямой @prisma/client/wasm(.js) в Node dev ломается на import() query_engine_bg.wasm.
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import { currentPrismaRequestId, resetPrismaForRequest } from './db-request-scope';

// CF Workers: HTTP fetch транспорт через poolQueryViaFetch=true.
// webSocketConstructor НЕ ставим — даже неиспользуемая ссылка на globalThis.WebSocket
// заставляет Neon Pool регистрировать обработчики, привязанные к контексту request-а;
// между запросами CF Workers выбрасывает "Cannot perform I/O on behalf of a different request".
neonConfig.poolQueryViaFetch = true;

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const log: Prisma.LogLevel[] = process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'];
  if (isLocalDatabaseUrl(url)) {
    return new PrismaClient({ log });
  }

  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
    log,
  });
}

// КРИТИЧНО: в CF Workers НЕ кэшируем PrismaClient между запросами.
// Pool держит fetch-state (HTTP keep-alive, Response объекты), привязанный
// к контексту первого request-а. Следующий request видит "Cannot perform I/O
// on behalf of a different request" → "Connection terminated" → 500/обрезанные ответы.
//
// Кешируем по-request: вешаем клиент на globalThis под уникальным ключом, который
// сбрасывается на каждом новом request-handler-е через requestPrismaScopeKey.
// В пределах одного request все вызовы prisma.* возвращают тот же клиент.
const PRISMA_SCOPE_KEY = Symbol.for('skiniq.prismaPerRequest');
const prismaStore = globalThis as unknown as {
  [PRISMA_SCOPE_KEY]?: { id: string; client: PrismaClient };
};

// Re-export для удобства (route handlers могут вызвать reset напрямую если нужно)
export { resetPrismaForRequest };

export const getPrisma = (): PrismaClient => {
  const reqId = currentPrismaRequestId();
  const cached = prismaStore[PRISMA_SCOPE_KEY];
  // В пределах одного request-а возвращаем тот же клиент.
  // На новом request middleware ставит новый reqId — старый кэш инвалидируется.
  if (cached && reqId && cached.id === reqId) {
    return cached.client;
  }
  // Fallback: если reqId не выставлен (Node/scripts), кэшируем как обычно
  if (!reqId && cached) {
    return cached.client;
  }
  const client = createPrismaClient();
  prismaStore[PRISMA_SCOPE_KEY] = { id: reqId, client };
  return client;
};

// Обратная совместимость — proxy который инициализируется при первом обращении
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});

// Функция для проверки подключения к БД
// Не вызываем $connect() — с driver adapters соединение устанавливается лениво при первом запросе
export async function checkDatabaseConnection() {
  try {
    // Выполняем простой запрос вместо $connect(), чтобы не триггерить бинарный движок
    await (getPrisma() as any).$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (error: any) {
    console.error('❌ Database connection error:', error);
    return {
      connected: false,
      error: error.message || 'Unknown database error',
    };
  }
}
