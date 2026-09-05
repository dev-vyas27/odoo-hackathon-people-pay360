-- 0009_payroll_processing.sql — payruns, payslips and their line items.
-- Owner: Dev C (modules/payroll-processing)

CREATE TABLE payruns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  salary_structure_id uuid NOT NULL REFERENCES salary_structures (id) ON DELETE RESTRICT,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  status              text NOT NULL DEFAULT 'draft',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payruns_status_valid
    CHECK (status IN ('draft', 'computed', 'validated', 'paid', 'cancelled')),
  CONSTRAINT payruns_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX payruns_period_idx ON payruns (period_start, period_end);

-- The employees explicitly selected in wizard step 2. Nothing writes here until
-- "Create Payrun" on the final step — step 1 must create no record at all.
CREATE TABLE payrun_employees (
  payrun_id   uuid NOT NULL REFERENCES payruns (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  PRIMARY KEY (payrun_id, employee_id)
);

CREATE TABLE payslips (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payrun_id    uuid NOT NULL REFERENCES payruns (id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  -- The PERIOD-APPLICABLE contract, resolved at compute time. Recording which
  -- one was used is what makes a historical payslip auditable after the
  -- employee's contract changes.
  contract_id  uuid REFERENCES contracts (id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  worked_days  numeric(6, 2) NOT NULL DEFAULT 0,
  -- Denormalised totals. The dashboard sums these directly instead of joining
  -- and aggregating payslip_lines on every chart.
  basic        numeric(14, 2) NOT NULL DEFAULT 0,
  gross        numeric(14, 2) NOT NULL DEFAULT 0,
  deductions   numeric(14, 2) NOT NULL DEFAULT 0,
  net          numeric(14, 2) NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payslips_status_valid
    CHECK (status IN ('draft', 'computed', 'validated', 'paid', 'cancelled')),
  CONSTRAINT payslips_period_valid CHECK (period_end >= period_start),
  -- One payslip per employee per run. This is the duplicate-payslip warning
  -- turned into an invariant the database will not let you violate.
  CONSTRAINT payslips_one_per_employee_per_run UNIQUE (payrun_id, employee_id)
);

CREATE INDEX payslips_employee_period_idx ON payslips (employee_id, period_start DESC);
-- The monthly-trend chart.
CREATE INDEX payslips_period_idx ON payslips (period_start, period_end);

/*
 * Line items are a table, not a JSON column.
 *
 * They are aggregated ("total HRA paid this quarter"), they have a stable
 * shape, and each one is a row a human reads on the payslip screen. A JSONB
 * blob here would make the single most-inspected part of the system opaque to
 * SQL.
 *
 * Crucially these are a SNAPSHOT: the computed amount is stored, not a pointer
 * to the rule that produced it. Editing a salary rule next quarter must not
 * silently rewrite last quarter's payslips. That is the difference between a
 * payroll system and a spreadsheet.
 */
CREATE TABLE payslip_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES payslips (id) ON DELETE CASCADE,
  code       text NOT NULL,
  name       text NOT NULL,
  category   text NOT NULL,
  -- Rendered in this order with the codes visible, so the computation is
  -- legible to anyone reading the payslip.
  sequence   integer NOT NULL,
  amount     numeric(14, 2) NOT NULL,

  CONSTRAINT payslip_lines_category_valid
    CHECK (category IN ('basic', 'allowance', 'gross', 'deduction', 'net')),
  CONSTRAINT payslip_lines_unique_code UNIQUE (payslip_id, code)
);

CREATE INDEX payslip_lines_payslip_sequence_idx ON payslip_lines (payslip_id, sequence);

CREATE TRIGGER payruns_updated_at BEFORE UPDATE ON payruns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payslips_updated_at BEFORE UPDATE ON payslips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
