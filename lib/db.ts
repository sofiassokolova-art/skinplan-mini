// lib/db.ts
// Prisma Client для работы с базой данных (Neon PostgreSQL)
// Использует @prisma/adapter-neon для совместимости с Cloudflare Workers/Pages

// Используем /wasm entry — он загружает движок через import() а не fs.readdir
// Это единственный вариант совместимый с CF Workers + driverAdapters
import { PrismaClient } from '@prisma/client/wasm';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

// В Cloudflare Workers используем HTTP fetch вместо WebSocket Pool.
// WebSocket-соединения stateful и переживают между запросами; CF Workers stateless,
// что ломает кэшированный Prisma-инстанс после первого запроса (второй query → 500
// или обрезанный ответ). poolQueryViaFetch=true роутит каждый query через fetch()
// → Neon HTTP API, каждый request получает свежее соединение.
//
// В Node (dev/scripts/тесты) WebSocket работает нормально — оставляем ветку для них.
if (typeof globalThis.WebSocket !== 'undefined') {
  // CF Workers: HTTP fetch транспорт — рекомендуемый Neon-ом для serverless edge.
  neonConfig.poolQueryViaFetch = true;
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  // @prisma/adapter-neon@6.x принимает PoolConfig напрямую (не Pool-инстанс)
  const adapter = new PrismaNeon({ connectionString: url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Lazy getter — инициализируем только при первом обращении во время запроса,
// когда CF Workers уже инжектил process.env из Dashboard Variables
export const getPrisma = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
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
