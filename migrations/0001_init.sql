-- 0001_init.sql — extensions and the shared trigger function.
-- Owner: Dev A
--
-- Migrations are plain SQL, applied in filename order by scripts/migrate.ts and
-- recorded in the schema_migrations table. Two rules:
--
--   1. NEVER edit a migration that has been applied. Add a new numbered file.
--      The runner stores a checksum and refuses to continue if a file it has
--      already applied has changed underneath it, because at that point the
--      database and the repository disagree and only one of them knows.
--   2. One file per domain, one owner per file. Three people adding
--      0010_*.sql, 0011_*.sql and 0012_*.sql never touch the same bytes.
--
-- On status columns: this schema uses TEXT with a named CHECK constraint rather
-- than a native ENUM type. Both are correct; CHECK was chosen because adding a
-- value is an ordinary ALTER TABLE that any of us can write, whereas ALTER TYPE
-- ... ADD VALUE has transaction-block restrictions that make it awkward inside a
-- migration runner. The permitted values mirror the `as const` arrays in
-- modules/shared/contracts/, which stay the single source of truth.

-- gen_random_uuid() is in core from PostgreSQL 13. The extension keeps this
-- working on 12 as well, and is a no-op on newer versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Every table carries created_at/updated_at. Mongoose maintained those for us;
-- in SQL it is one trigger function reused by every table, which is both less
-- code and impossible for an application bug to skip.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS
  'Attach with: CREATE TRIGGER <table>_updated_at BEFORE UPDATE ON <table> FOR EACH ROW EXECUTE FUNCTION set_updated_at();';
