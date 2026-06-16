// scripts/normalize-hydration-concern.ts
//
// Нормализует concern-слаг "hydration" -> "dehydration" в steps_json правил
// recommendation_rules, чтобы он совпадал с тем, как размечены продукты
// (products.concerns используют "dehydration").
//
// Почему это нужно: матчер в lib/product-selection.ts применяет concerns как
// строгий фильтр (OR: [{concerns hasSome step.concerns}, {concerns isEmpty}]),
// поэтому toner/serum-шаги с concerns:["hydration"] НИКОГДА не матчат
// увлажняющие продукты по concern — проходят только через escape isEmpty.
//
// Использует pg Pool (Prisma здесь требует driver adapter — PrismaClient в
// node-скрипте не работает). По умолчанию DRY-RUN с ROLLBACK; для коммита
// передать флаг --commit.
//
// Запуск (dry-run):  DATABASE_URL='postgres://...' tsx scripts/normalize-hydration-concern.ts
// Запуск (commit):   DATABASE_URL='postgres://...' tsx scripts/normalize-hydration-concern.ts --commit

import { Pool } from 'pg';

const OLD_SLUG = 'hydration';
const NEW_SLUG = 'dehydration';
const COMMIT = process.argv.includes('--commit');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Не задан DATABASE_URL. Запусти так:');
  console.error("   DATABASE_URL='postgres://...' tsx scripts/normalize-hydration-concern.ts [--commit]");
  process.exit(1);
}

type StepsJson = Record<string, any>;

/** Заменяет OLD_SLUG -> NEW_SLUG во всех step.concerns. Возвращает изменённые шаги. */
function normalizeSteps(steps: StepsJson): { changed: boolean; touchedSteps: string[]; next: StepsJson } {
  const touchedSteps: string[] = [];
  const next: StepsJson = JSON.parse(JSON.stringify(steps));

  for (const [stepName, step] of Object.entries(next)) {
    if (!step || typeof step !== 'object') continue;
    const concerns = (step as any).concerns;
    if (!Array.isArray(concerns)) continue;
    if (!concerns.includes(OLD_SLUG)) continue;

    // Заменяем, дедуплицируем (на случай если dehydration уже есть в массиве)
    const replaced = concerns.map((c: string) => (c === OLD_SLUG ? NEW_SLUG : c));
    (step as any).concerns = Array.from(new Set(replaced));
    touchedSteps.push(stepName);
  }

  return { changed: touchedSteps.length > 0, touchedSteps, next };
}

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // ── 0. Контекст БД ──────────────────────────────────────────────
    const dbInfo = await client.query(
      `SELECT current_database() AS db, inet_server_addr()::text AS host`
    );
    console.log(`📡 БД: ${dbInfo.rows[0].db}  host: ${dbInfo.rows[0].host ?? '(hidden)'}`);
    console.log(`🔧 Режим: ${COMMIT ? 'COMMIT (запись!)' : 'DRY-RUN (ROLLBACK)'}\n`);

    // ── 1. Верификация: какие concern-слаги реально используют продукты ──
    console.log('── Продукты: распределение concern-слагов (top) ──');
    const productConcerns = await client.query(
      `SELECT concern, COUNT(*)::int AS n
         FROM products, UNNEST(concerns) AS concern
        GROUP BY concern
        ORDER BY n DESC`
    );
    for (const r of productConcerns.rows) {
      const flag =
        r.concern === NEW_SLUG ? '  ✅ (канонический)' : r.concern === OLD_SLUG ? '  ⚠️ (в продуктах НЕ должен встречаться)' : '';
      console.log(`   ${String(r.n).padStart(4)}  ${r.concern}${flag}`);
    }
    const productsWithOld = productConcerns.rows.find((r: any) => r.concern === OLD_SLUG);
    if (productsWithOld) {
      console.log(
        `\n⚠️  ВНИМАНИЕ: ${productsWithOld.n} продуктов уже размечены "${OLD_SLUG}". ` +
          `Нормализация правил под "${NEW_SLUG}" может не охватить их — проверь вручную.`
      );
    }
    console.log('');

    // ── 2. Находим правила со steps_json, где есть concern "hydration" ──
    // (любой шаг, не только toner — serum тоже затронут)
    const rules = await client.query<{ id: number; name: string; steps_json: StepsJson }>(
      `SELECT id, name, steps_json
         FROM recommendation_rules
        WHERE steps_json::text LIKE '%"${OLD_SLUG}"%'
        ORDER BY id`
    );

    console.log(`── Правила, содержащие "${OLD_SLUG}" в steps_json: ${rules.rows.length} ──\n`);

    await client.query('BEGIN');

    let updatedCount = 0;
    for (const rule of rules.rows) {
      const { changed, touchedSteps, next } = normalizeSteps(rule.steps_json);
      if (!changed) {
        // "hydration" встретился где-то ещё (не в concerns) — не трогаем
        console.log(`   id=${rule.id} "${rule.name}" — "${OLD_SLUG}" не в step.concerns, пропуск`);
        continue;
      }

      console.log(`   id=${rule.id} "${rule.name}" — шаги: [${touchedSteps.join(', ')}]`);
      for (const s of touchedSteps) {
        console.log(`        ${s}.concerns: ${JSON.stringify(rule.steps_json[s].concerns)} -> ${JSON.stringify(next[s].concerns)}`);
      }

      await client.query(`UPDATE recommendation_rules SET steps_json = $1::jsonb WHERE id = $2`, [
        JSON.stringify(next),
        rule.id,
      ]);
      updatedCount++;
    }

    console.log(`\n── Обновлено правил: ${updatedCount} ──`);

    if (COMMIT) {
      await client.query('COMMIT');
      console.log('✅ COMMIT выполнен.');

      // Пост-проверка
      const left = await client.query(
        `SELECT COUNT(*)::int AS n FROM recommendation_rules WHERE steps_json::text LIKE '%"${OLD_SLUG}"%'`
      );
      console.log(`🔎 Осталось правил с "${OLD_SLUG}" в steps_json: ${left.rows[0].n} (ожидаемо 0, если все были в concerns)`);
    } else {
      await client.query('ROLLBACK');
      console.log('↩️  ROLLBACK выполнен (dry-run). Для записи запусти с --commit.');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});
