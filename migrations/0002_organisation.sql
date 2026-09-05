-- 0002_organisation.sql — departments, job positions and working schedules.
-- Owner: Dev B (modules/people, modules/employment)
--
-- These come first because employees reference all three, and a foreign key
-- cannot point at a table that does not exist yet. The file order in this
-- folder is dependency order, not importance order.

CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL,
  -- Set in 0004 once employees exists; a department's manager is an employee,
  -- and an employee belongs to a department, so one of the two FKs has to be
  -- added after the fact. This is the standard way out of that cycle.
  manager_id  uuid,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_key UNIQUE (name),
  CONSTRAINT departments_code_key UNIQUE (code)
);

CREATE TABLE job_positions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  department_id uuid REFERENCES departments (id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_positions_department_idx ON job_positions (department_id);

CREATE TABLE working_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  -- Derived from working_schedule_days by weekly-hours.service.ts and written
  -- here for cheap reads. It is never entered by a user; the form computes it.
  weekly_hours numeric(6, 2) NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT working_schedules_name_key UNIQUE (name),
  CONSTRAINT working_schedules_hours_sane CHECK (weekly_hours >= 0 AND weekly_hours <= 168)
);

-- The day pattern is its own table rather than a JSON column: it is queried
-- ("which schedules work Saturdays"), it is validated per row, and the shape is
-- fixed. A JSONB blob here would be a document database hiding inside a
-- relational one.
CREATE TABLE working_schedule_days (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  working_schedule_id uuid NOT NULL REFERENCES working_schedules (id) ON DELETE CASCADE,
  -- 0 = Sunday, matching JavaScript's Date.getUTCDay().
  day_of_week         smallint NOT NULL,
  starts_at           time NOT NULL,
  ends_at             time NOT NULL,
  break_minutes       integer NOT NULL DEFAULT 0,
  CONSTRAINT wsd_day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT wsd_break_non_negative CHECK (break_minutes >= 0),
  CONSTRAINT wsd_ends_after_starts CHECK (ends_at > starts_at),
  -- One row per schedule per weekday. The database enforces it so a duplicate
  -- cannot silently double the computed weekly hours.
  CONSTRAINT wsd_unique_day UNIQUE (working_schedule_id, day_of_week)
);

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER job_positions_updated_at BEFORE UPDATE ON job_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER working_schedules_updated_at BEFORE UPDATE ON working_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
