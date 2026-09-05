-- 0006_employment.sql — contracts.
-- Owner: Dev B (modules/employment)
--
-- The table payroll is built on. `findApplicableContract(employeeId, period)`
-- resolves the contract that applies to a PAYROLL PERIOD, never "the current
-- one", and this is where that query gets its index.

CREATE TABLE contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  -- Major units (rupees, not paise). Money.of(row.wage) at the boundary.
  -- numeric, never float: 0.1 + 0.2 <> 0.3 and payroll cannot afford that.
  wage                numeric(14, 2) NOT NULL,
  salary_structure_id uuid REFERENCES salary_structures (id) ON DELETE SET NULL,
  working_schedule_id uuid REFERENCES working_schedules (id) ON DELETE SET NULL,
  starts_on           date NOT NULL,
  -- NULL = open-ended, which is why the overlap constraint below uses an
  -- unbounded upper end rather than coalescing to a far-future date.
  ends_on             date,
  status              text NOT NULL DEFAULT 'draft',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contracts_wage_non_negative CHECK (wage >= 0),
  CONSTRAINT contracts_status_valid
    CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  CONSTRAINT contracts_ends_after_starts CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

/*
 * "Avoiding concurrent active contracts" — enforced by the database, not by a
 * read-your-own-write check in the application.
 *
 * An EXCLUSION constraint is the relational answer to this. It says: no two
 * rows may share an employee_id AND have overlapping date ranges, considering
 * only rows where status = 'active'. Two requests racing to create overlapping
 * contracts cannot both win, which an application-level "does one already
 * exist?" check can never guarantee.
 *
 * daterange(starts_on, ends_on, '[]') is inclusive at both ends, matching the
 * Period value object. A NULL ends_on produces an unbounded range, so an
 * open-ended contract correctly conflicts with everything after its start.
 */
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE contracts ADD CONSTRAINT contracts_no_concurrent_active
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  ) WHERE (status = 'active');

-- The hottest query in payroll: one employee, ordered by validity.
CREATE INDEX contracts_employee_period_idx ON contracts (employee_id, starts_on, ends_on);
CREATE INDEX contracts_structure_idx ON contracts (salary_structure_id);

CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
