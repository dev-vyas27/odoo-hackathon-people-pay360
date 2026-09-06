-- 0005_identity.sql — login accounts.
-- Owner: Dev A (modules/identity)
--
-- A user is a credential with a role; an employee is an HR record. They are
-- separate tables on purpose. Not every employee has a login, an administrator
-- may have no employee record at all, and "disable the login but keep the
-- payroll history" has to remain possible.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'employee',
  -- The link that makes row-level scoping work: an `employee` role may read
  -- only the records belonging to this employee_id.
  employee_id   uuid REFERENCES employees (id) ON DELETE SET NULL,
  password_hash text NOT NULL,
  -- A deactivated account cannot sign in even with the correct password.
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_role_valid CHECK (
    role IN ('employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin')
  )
);

-- Email is matched case-insensitively at login (the domain lower-cases it
-- before querying), so the uniqueness guarantee has to be case-insensitive too.
-- A plain UNIQUE(email) would happily accept Admin@x.com alongside admin@x.com
-- and produce two accounts that look identical on screen.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE INDEX users_employee_idx ON users (employee_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN users.password_hash IS
  'bcrypt. Never selected by default — repositories list columns explicitly and omit this one except in findByEmail.';
