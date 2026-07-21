// scripts/audit-plan-invariants.ts
//
// Периодический аудит инвариантов «слот ↔ продукт» по всем plan28 в БД.
// Те же проверки, что validatePlanInvariants в lib/plan-invariants.ts
// (при изменении правил там — синхронизировать CASE/regex'ы здесь):
//   base_mismatch      — базовый тип слота != базовый тип продукта
//   acid_in_soft_slot  — кислота/эксфолиант/ретиноид в soothing/hydrating/barrier/gentle-слоте
//   dup_in_routine     — один productId дважды внутри morning/evening/weekly одного дня
//   empty_step         — шаг без productId и без manualLabel
//
// Аудит по ПОСЛЕДНЕМУ плану каждого юзера. Вся работа — server-side одним
// SQL-запросом (сеть до Neon флаки, гонять JSON планов на клиент нельзя),
// pg TCP :5432 + ретраи с пересозданием пула.
//
// Запуск (сводка):   DATABASE_URL='postgres://...' npx tsx scripts/audit-plan-invariants.ts
// Запуск (по юзерам): DATABASE_URL='postgres://...' npx tsx scripts/audit-plan-invariants.ts --details

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Не задан DATABASE_URL. Запусти так:');
  console.error("   DATABASE_URL='postgres://...' npx tsx scripts/audit-plan-invariants.ts [--details]");
  process.exit(1);
}

const SHOW_DETAILS = process.argv.includes('--details');
const RETRY_ATTEMPTS = 5;

// Neon требует TLS; локальный postgres (sslmode=disable или localhost) — нет.
const sslConfig =
  /sslmode=disable/.test(connectionString) || /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false };

// Базовый тип по префиксу строки — зеркало getInvariantBase из lib/plan-invariants.ts.
// Порядок важен: eye_cream/spot_treatment/lip_care до односложных и до '%cream%'.
function baseCaseSql(col: string): string {
  return `CASE
    WHEN ${col} LIKE 'eye_cream%' OR ${col} LIKE 'eye%' THEN 'eye_cream'
    WHEN ${col} LIKE 'spot_treatment%' THEN 'spot_treatment'
    WHEN ${col} LIKE 'lip%' THEN 'lip_care'
    WHEN ${col} LIKE 'cleanser%' THEN 'cleanser'
    WHEN ${col} LIKE 'toner%' THEN 'toner'
    WHEN ${col} LIKE 'serum%' THEN 'serum'
    WHEN ${col} LIKE 'treatment%' THEN 'treatment'
    WHEN ${col} LIKE 'moisturizer%' OR ${col} LIKE '%cream%' THEN 'moisturizer'
    WHEN ${col} LIKE 'spf%' OR ${col} LIKE '%sunscreen%' THEN 'spf'
    WHEN ${col} LIKE 'mask%' THEN 'mask'
    WHEN ${col} LIKE 'balm%' THEN 'balm'
    ELSE NULL
  END`;
}

// Общие CTE: последний план каждого юзера → развёртка шагов → join products + классификация.
const ENRICHED_CTE = `
WITH latest AS (
  SELECT DISTINCT ON (user_id) id, user_id, created_at, plan_data
  FROM plan28
  ORDER BY user_id, created_at DESC
),
steps AS (
  SELECT
    l.id AS plan_id,
    l.user_id,
    l.created_at,
    COALESCE((d.value->>'dayIndex')::int, d.ord::int) AS day_index,
    r.routine,
    lower(replace(COALESCE(s.value->>'stepCategory', ''), '-', '_')) AS step_category,
    NULLIF(s.value->>'productId', '') AS product_id,
    NULLIF(s.value->>'manualLabel', '') AS manual_label
  FROM latest l
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.plan_data->'days', '[]'::jsonb)) WITH ORDINALITY AS d(value, ord)
  CROSS JOIN LATERAL (VALUES ('morning'), ('evening'), ('weekly')) AS r(routine)
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.value->r.routine) = 'array' THEN d.value->r.routine ELSE '[]'::jsonb END
  ) AS s(value)
),
enriched AS (
  SELECT
    st.*,
    p.name AS product_name,
    lower(replace(COALESCE(p.step, ''), '-', '_')) AS product_step,
    ${baseCaseSql('st.step_category')} AS slot_base,
    ${baseCaseSql(`lower(replace(COALESCE(p.step, ''), '-', '_'))`)} AS product_base,
    (st.step_category ~ '(soothing|hydrating|barrier|gentle)') AS is_soft_slot,
    (
      p.id IS NOT NULL AND (
        lower(replace(COALESCE(p.step, ''), '-', '_')) ~ '(^|_)(aha|bha|pha|acid|exfoliant|peel|retin)'
        OR EXISTS (
          SELECT 1 FROM unnest(p.active_ingredients) AS ai
          WHERE lower(ai) ~ '(glycolic|гликол|salicyl|салицил|mandelic|миндал|tretinoin|третиноин|adapalene|адапален|retinoid|retinol|retinal|ретин)'
             OR lower(ai) ~ '(^|[^a-zа-яё])(aha|bha|pha|lactic|молочная)([^a-zа-яё]|$)'
        )
      )
    ) AS is_acid_product
  FROM steps st
  LEFT JOIN products p ON p.id::text = st.product_id
),
issues AS (
  -- base_mismatch: допустимые кросс-пары (balm↔moisturizer, treatment←serum/spot,
  -- spot←treatment, mask←treatment) — зеркало ALLOWED_CROSS_BASE
  SELECT user_id, plan_id, created_at, day_index, routine, 'base_mismatch' AS issue,
         routine || '/' || step_category || ' <- ' || COALESCE(product_step, '?')
           || ' #' || product_id || ' (' || COALESCE(product_name, '?') || ')' AS pattern
  FROM enriched
  WHERE product_id IS NOT NULL
    AND slot_base IS NOT NULL AND product_base IS NOT NULL
    AND slot_base <> product_base
    AND NOT (slot_base = 'balm' AND product_base = 'moisturizer')
    AND NOT (slot_base = 'moisturizer' AND product_base = 'balm')
    AND NOT (slot_base = 'treatment' AND product_base IN ('serum', 'spot_treatment'))
    AND NOT (slot_base = 'spot_treatment' AND product_base = 'treatment')
    AND NOT (slot_base = 'mask' AND product_base = 'treatment')

  UNION ALL

  SELECT user_id, plan_id, created_at, day_index, routine, 'acid_in_soft_slot',
         routine || '/' || step_category || ' <- ' || COALESCE(product_step, '?')
           || ' #' || product_id || ' (' || COALESCE(product_name, '?') || ')'
  FROM enriched
  WHERE is_soft_slot AND is_acid_product

  UNION ALL

  SELECT user_id, plan_id, min(created_at), day_index, routine, 'dup_in_routine',
         routine || ': product #' || product_id || ' (' || COALESCE(min(product_name), '?') || ') повторяется'
  FROM enriched
  WHERE product_id IS NOT NULL
  GROUP BY user_id, plan_id, day_index, routine, product_id
  HAVING count(*) > 1

  UNION ALL

  SELECT user_id, plan_id, created_at, day_index, routine, 'empty_step',
         routine || '/' || step_category || ' (нет productId и manualLabel)'
  FROM enriched
  WHERE product_id IS NULL AND manual_label IS NULL
)`;

const SUMMARY_SQL = `${ENRICHED_CTE}
SELECT
  issue,
  pattern,
  COUNT(DISTINCT user_id)::int AS users,
  COUNT(*)::int AS occurrences,
  MIN(day_index) AS first_day,
  MAX(day_index) AS last_day,
  (array_agg(DISTINCT user_id))[1:5] AS sample_users
FROM issues
GROUP BY issue, pattern
ORDER BY issue, users DESC, occurrences DESC`;

const DETAILS_SQL = `${ENRICHED_CTE}
SELECT
  issue,
  user_id,
  MIN(created_at)::date AS plan_date,
  COUNT(*)::int AS occurrences,
  COUNT(DISTINCT day_index)::int AS days_affected,
  (array_agg(DISTINCT pattern))[1:3] AS sample_patterns
FROM issues
GROUP BY issue, user_id
ORDER BY issue, occurrences DESC`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Каждая попытка — свежий пул: флаки-сеть до Neon оставляет мёртвые коннекты.
async function queryWithRetry(sql: string): Promise<{ rows: any[] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const pool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: 1,
      connectionTimeoutMillis: 15_000,
    });
    try {
      return await pool.query(sql);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Попытка ${attempt}/${RETRY_ATTEMPTS} не удалась: ${message}`);
      if (attempt < RETRY_ATTEMPTS) await sleep(2_000 * attempt);
    } finally {
      await pool.end().catch(() => {});
    }
  }
  throw lastError;
}

async function main() {
  const dbInfo = await queryWithRetry(
    `SELECT current_database() AS db, (SELECT COUNT(DISTINCT user_id)::int FROM plan28) AS users_with_plans`
  );
  console.log(`📡 БД: ${dbInfo.rows[0].db}, юзеров с планами: ${dbInfo.rows[0].users_with_plans}`);
  console.log(`🔎 Аудит по последнему плану каждого юзера...\n`);

  const summary = await queryWithRetry(SUMMARY_SQL);

  if (summary.rows.length === 0) {
    console.log('✅ Нарушений инвариантов не найдено.');
    return;
  }

  let currentIssue = '';
  const totals = new Map<string, number>();

  for (const row of summary.rows) {
    if (row.issue !== currentIssue) {
      currentIssue = row.issue;
      console.log(`\n━━ ${currentIssue} ━━`);
    }
    console.log(`  ${row.users} юз. × ${row.occurrences} вхожд. (дни ${row.first_day}–${row.last_day})`);
    console.log(`    ${row.pattern}`);
    console.log(`    примеры: ${row.sample_users.join(', ')}`);

    totals.set(row.issue, (totals.get(row.issue) ?? 0) + row.occurrences);
  }

  console.log(`\n━━ Итого ━━`);
  totals.forEach((occurrences, issue) => {
    console.log(`  ${issue}: ${occurrences} вхождений`);
  });

  if (SHOW_DETAILS) {
    console.log(`\n━━ По юзерам (--details) ━━`);
    const details = await queryWithRetry(DETAILS_SQL);
    for (const row of details.rows) {
      console.log(
        `  [${row.issue}] ${row.user_id} (план от ${row.plan_date.toISOString?.().slice(0, 10) ?? row.plan_date}): ` +
          `${row.occurrences} вхожд., ${row.days_affected} дн.`
      );
      for (const p of row.sample_patterns) console.log(`      ${p}`);
    }
  } else {
    console.log(`\nℹ️  Для разбивки по юзерам добавь флаг --details`);
  }
}

main().catch((error) => {
  console.error('❌ Аудит не удался:', error instanceof Error ? error.message : error);
  process.exit(1);
});
