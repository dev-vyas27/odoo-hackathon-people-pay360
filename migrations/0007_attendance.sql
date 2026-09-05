-- 0007_attendance.sql — daily attendance records.
-- Owner: Dev B (modules/attendance)

CREATE TABLE attendances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees (id) ON DELETE CASCADE,
  -- The calendar day being recorded. `date`, not `timestamptz`: "the 3rd of
  -- March" is not a moment in time and storing it as one reintroduces every
  -- timezone bug the Period value object exists to avoid.
  worked_on     date NOT NULL,
  checked_in_at timestamptz,
  -- NULL here IS the missing_checkout exception, not missing data.
  checked_out_at timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  -- Derived by worked-hours.service.ts and stored so the dashboard can SUM it
  -- without recomputing across 60 days x 25 employees on every page load.
  worked_hours  numeric(6, 2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'present',
  -- Set by correct-attendance; surfaced as `manualEdits` on the dashboard so an
  -- auditor can see which rows a human touched.
  is_manual     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT attendances_status_valid
    CHECK (status IN ('present', 'late', 'absent', 'overtime', 'missing_checkout')),
  CONSTRAINT attendances_break_non_negative CHECK (break_minutes >= 0),
  CONSTRAINT attendances_hours_non_negative CHECK (worked_hours >= 0),
  CONSTRAINT attendances_checkout_after_checkin
    CHECK (checked_out_at IS NULL OR checked_in_at IS NULL OR checked_out_at >= checked_in_at),

  -- One row per person per day, enforced by the database. Duplicate attendance
  -- silently doubles worked days, which silently overpays a payslip.
  CONSTRAINT attendances_one_per_day UNIQUE (employee_id, worked_on)
);

CREATE INDEX attendances_employee_date_idx ON attendances (employee_id, worked_on DESC);
-- The dashboard's exception summary: "how many late/absent in this period".
CREATE INDEX attendances_date_status_idx ON attendances (worked_on, status);

CREATE TRIGGER attendances_updated_at BEFORE UPDATE ON attendances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
