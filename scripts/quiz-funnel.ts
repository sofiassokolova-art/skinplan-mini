// scripts/quiz-funnel.ts
// Считает воронку анкеты по событиям поэкранной телеметрии (lib/quiz-telemetry.ts).
//
// Запуск:
//   DATABASE_URL=postgres://... npx tsx scripts/quiz-funnel.ts
//   DATABASE_URL=... DAYS=7 npx tsx scripts/quiz-funnel.ts
//
// Важно про горизонт: /api/logs удаляет записи старше 7 дней, поэтому воронка
// всегда скользящая. Для истории нужно выгружать агрегат наружу регулярно.
//
// Порядок шагов берём из фактических данных (медиана позиции показа у юзеров),
// а не из INFO_SCREENS: вопросы приходят из БД и перемежаются с экранами,
// единого статического списка «шаг за шагом» в коде не существует.

import { Client } from 'pg';
import { QUIZ_STEP_MESSAGE } from '../lib/quiz-telemetry';

const DAYS = Number(process.env.DAYS || 7);

interface Row {
  subject: string; // userId или telegramId
  kind: string;
  id: string;
  index: number | null;
  createdAt: Date;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Нужен DATABASE_URL');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(
    `SELECT COALESCE(user_id, telegram_id) AS subject,
            context->>'kind' AS kind,
            context->>'id'   AS id,
            (context->>'index')::int AS index,
            created_at
     FROM client_logs
     WHERE message = $1
       AND created_at > now() - ($2 || ' days')::interval
       AND COALESCE(user_id, telegram_id) IS NOT NULL
     ORDER BY created_at ASC`,
    [QUIZ_STEP_MESSAGE, String(DAYS)]
  );
  await client.end();

  const rows: Row[] = res.rows.map((r: any) => ({
    subject: r.subject,
    kind: r.kind,
    id: r.id,
    index: r.index,
    createdAt: r.created_at,
  }));

  if (rows.length === 0) {
    console.log(`Событий нет за последние ${DAYS} дн.`);
    console.log('Если телеметрия только что задеплоена — данные появятся после первых прохождений.');
    return;
  }

  // Кто какие шаги видел
  const bySubject = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = bySubject.get(r.subject) || [];
    arr.push(r);
    bySubject.set(r.subject, arr);
  }

  const totalUsers = bySubject.size;

  // Порядок шага = медиана порядкового номера показа внутри сессии юзера.
  const ordinals = new Map<string, number[]>();
  const reachedBy = new Map<string, Set<string>>();
  const labels = new Map<string, string>();

  for (const [subject, steps] of bySubject) {
    steps.forEach((s, i) => {
      const key = `${s.kind}:${s.id}`;
      labels.set(key, `${s.kind === 'info' ? '[экран]' : '[вопрос]'} ${s.id}`);
      const ord = ordinals.get(key) ?? [];
      ord.push(i);
      ordinals.set(key, ord);

      const set = reachedBy.get(key) ?? new Set<string>();
      set.add(subject);
      reachedBy.set(key, set);
    });
  }

  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const steps = [...reachedBy.keys()].sort(
    (a, b) => median(ordinals.get(a)!) - median(ordinals.get(b)!)
  );

  console.log(`\nВоронка анкеты за ${DAYS} дн.  Всего дошедших хотя бы до одного шага: ${totalUsers}\n`);
  console.log('шаг'.padEnd(42), 'дошли'.padStart(6), 'от начала'.padStart(11), 'отвал'.padStart(8));
  console.log('-'.repeat(72));

  let prev: number | null = null;
  for (const key of steps) {
    const n = reachedBy.get(key)!.size;
    const pctTotal = ((n / totalUsers) * 100).toFixed(0) + '%';
    const drop = prev === null ? '—' : (prev - n === 0 ? '0' : `-${prev - n}`);
    const label = labels.get(key)!;
    console.log(
      label.slice(0, 42).padEnd(42),
      String(n).padStart(6),
      pctTotal.padStart(11),
      String(drop).padStart(8)
    );
    prev = n;
  }

  // Самые болезненные переходы
  console.log('\nКрупнейшие отвалы между соседними шагами:');
  const drops: Array<{ from: string; to: string; lost: number }> = [];
  for (let i = 1; i < steps.length; i++) {
    const a = reachedBy.get(steps[i - 1])!.size;
    const b = reachedBy.get(steps[i])!.size;
    if (a - b > 0) drops.push({ from: labels.get(steps[i - 1])!, to: labels.get(steps[i])!, lost: a - b });
  }
  drops.sort((x, y) => y.lost - x.lost);
  if (drops.length === 0) {
    console.log('  нет — до последнего шага дошли все');
  } else {
    for (const d of drops.slice(0, 5)) {
      console.log(`  -${d.lost}  ${d.from}  →  ${d.to}`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
