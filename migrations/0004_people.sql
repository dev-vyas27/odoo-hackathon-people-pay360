-- 0004_people.sql — the employee table, and the deferred department FK.
-- Owner: Dev B (modules/people)
--
-- Employee is the hub of this schema: contracts, attendance, allocations, leave
-- requests and payslips all point here.

CREATE TABLE employees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  email               text NOT NULL,
  phone               text,
  department_id       uuid REFERENCES departments (id) ON DELETE SET NULL,
  job_position_id     uuid REFERENCES job_positions (id) ON DELETE SET NULL,
  -- Self-reference for the reporting line. ON DELETE SET NULL rather than
  -- CASCADE: a manager leaving must not delete their whole team.
  manager_id          uuid REFERENCES employees (id) ON DELETE SET NULL,
  working_schedule_id uuid REFERENCES working_schedules (id) ON DELETE SET NULL,
  employee_type       text NOT NULL DEFAULT 'full_time',
  -- Read by Dev C's missing-bank-details warning before a payrun is finalised.
  bank_account        text,
  -- Archiving sets this false. Employees are never deleted: payslips and
  -- attendance reference them, and payroll history is the point of the system.
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT employees_email_key UNIQUE (email),
  CONSTRAINT employees_type_valid
    CHECK (employee_type IN ('full_time', 'part_time', 'contract', 'intern')),
  -- An employee cannot manage themselves. Cheap to state, and it closes the
  -- one-node cycle that would make a reporting-line walk loop forever.
  CONSTRAINT employees_not_own_manager CHECK (manager_id IS NULL OR manager_id <> id)
);

-- Every dashboard aggregation and the payrun eligibility query filter on
-- exactly this pair, so it is one composite index rather than two single ones.
CREATE INDEX employees_department_active_idx ON employees (department_id, is_active);
CREATE INDEX employees_manager_idx ON employees (manager_id);
-- Powers the case-insensitive name search on the employee list.
CREATE INDEX employees_name_lower_idx ON employees (lower(name));

-- The other half of the departments <-> employees cycle, now that both tables
-- exist. See the comment on departments.manager_id in 0002.
ALTER TABLE departments
  ADD CONSTRAINT departments_manager_fk
  FOREIGN KEY (manager_id) REFERENCES employees (id) ON DELETE SET NULL;

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
