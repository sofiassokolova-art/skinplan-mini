# Prisma migrations

## Baseline (`0_init`)

`0_init` is a **squashed baseline** generated from `prisma/schema.prisma` on 2026-06-06.
It reproduces the entire schema (verified: `prisma migrate diff --exit-code` reports no
difference). The previous history was broken and incomplete (no initial migration; the base
schema had only ever been applied to Neon via `prisma db push`), so it was replaced.

`migrate deploy` now applies cleanly to an **empty** database. For new databases there is
nothing extra to do.

## Reconciling existing databases (prod / staging Neon)

The existing Neon DBs **already contain the full schema** (built via `db push`). You must NOT
re-run `0_init` against them — instead mark it as already applied. Run these manually, one
environment at a time, **staging first**, with the relevant connection string.

> Neon environments (see project memory): `neon-blue-chair` = staging, `neon-red-yacht` = prod.

```bash
# --- STAGING first ---
export STAGING_URL="postgresql://...neon-blue-chair..."

# 1. Detect drift (read-only). Expect "No difference detected" (exit 0).
#    If it reports changes, the env's schema diverges from schema.prisma — resolve BEFORE
#    baselining (e.g. staging may be missing the 4 perf indexes that exist on prod from the
#    old optimize_indexes.sql; apply them or accept the diff, then re-check).
npx prisma migrate diff --from-url "$STAGING_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

# 2. Inspect _prisma_migrations. db push never creates it, so it likely does NOT exist.
#    If past `migrate deploy` runs left rows (e.g. a failed `20251203154254_add_feedback_type`),
#    clear them so only the baseline is recorded:
#      psql "$STAGING_URL" -c 'SELECT migration_name, finished_at, applied_steps_count FROM "_prisma_migrations";'
#      psql "$STAGING_URL" -c 'DROP TABLE IF EXISTS "_prisma_migrations";'

# 3. Mark the baseline as already-applied. This records 0_init in _prisma_migrations and runs
#    NO DDL — your data and tables are untouched.
DATABASE_URL="$STAGING_URL" npx prisma migrate resolve --applied 0_init

# 4. Verify.
DATABASE_URL="$STAGING_URL" npx prisma migrate status   # -> "Database schema is up to date!"
```

After staging is confirmed clean, repeat with `PROD_URL` (`neon-red-yacht`). Prod already has
the 4 perf indexes (they came from the old `optimize_indexes.sql`), so its step-1 drift check
should be clean.

## Creating future migrations

The directory is now tracked in git (the old `prisma/migrations/` `.gitignore` rule was
removed), so `migrate deploy` will run real migrations on deploy. Going forward use
`npx prisma migrate dev --name <change>` to add migrations rather than `db push`.
