-- 0013_working_schedule_type.sql — Full-time vs part-time, stored (spec A3).
-- Owner: this agent (modules/employment)
--
-- Spec A3 requires the schedule list to show "name, type, and weekly hours".
-- Until now "type" did not exist as data at all -- it was only ever INFERRED
-- client-side from a weekly-hours threshold (`isFullTimeSchedule` in
-- modules/employment/schemas.ts, >= 35h counts as full time). That is fine as
-- a one-off classification but is not a column the list view can read, so it
-- becomes one here.
--
-- Backfill for existing rows uses that SAME >= 35h threshold, so current
-- schedules get a defensible classification instead of every row collapsing
-- onto one default value.
ALTER TABLE working_schedules
  ADD COLUMN type text;

UPDATE working_schedules
   SET type = CASE WHEN weekly_hours >= 35 THEN 'full_time' ELSE 'part_time' END;

/*
 * A trigger, not just a DEFAULT, and not a bare NOT NULL.
 *
 * A plain `DEFAULT 'full_time'` would give every FUTURE row lacking a `type`
 * the same value regardless of its actual hours -- exactly the "blindly
 * defaulting" this migration exists to avoid. The application always sends an
 * explicit `type` from here on (see modules/employment/interface/schedule.schema.ts),
 * but scripts/seed/parts/people.seed.ts inserts `working_schedules` rows with
 * no `type` column at all and is outside this change's file ownership, so it
 * cannot be updated to supply one directly. This trigger derives the same
 * hours-based answer for any insert that omits the column, keeping the seed
 * script (and any other unmigrated writer) working without a NOT NULL
 * violation and without silently mislabelling a part-time row as full time.
 */
CREATE OR REPLACE FUNCTION working_schedule_type_default() RETURNS trigger AS $$
BEGIN
  IF NEW.type IS NULL THEN
    NEW.type := CASE WHEN NEW.weekly_hours >= 35 THEN 'full_time' ELSE 'part_time' END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER working_schedules_type_default
  BEFORE INSERT ON working_schedules
  FOR EACH ROW EXECUTE FUNCTION working_schedule_type_default();

ALTER TABLE working_schedules
  ALTER COLUMN type SET NOT NULL;

ALTER TABLE working_schedules
  ADD CONSTRAINT working_schedules_type_valid
  CHECK (type IN ('full_time', 'part_time'));

COMMENT ON COLUMN working_schedules.type IS
  'Full-time vs part-time (spec A3). Explicit on every create/update from the app; the BEFORE INSERT trigger only fills it in for writers that do not know about this column yet.';
