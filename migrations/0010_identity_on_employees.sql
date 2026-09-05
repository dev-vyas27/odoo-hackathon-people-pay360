-- 0010_identity_on_employees.sql — fold `users` into `employees`.
--
-- 0005 kept them apart, and its reasoning was sound in the abstract: not every
-- employee needs a login, and an administrator might have no HR record. In THIS
-- product neither case occurs. An administrator creates an employee, and that
-- employee is the account — there is no other way for a person to enter the
-- system. Two tables in a one-to-one relationship that is always populated is a
-- join and a class of bug (an orphan login, a person with two identities) in
-- exchange for flexibility nobody uses.
--
-- After this migration the employee row IS the identity.

-- ── credentials on the employee ─────────────────────────────────────────────

ALTER TABLE employees
  ADD COLUMN role          text NOT NULL DEFAULT 'employee',
  -- NULLABLE, and that nullability carries the meaning: an employee with no
  -- hash is an HR record that cannot sign in. That is how "on the payroll but
  -- has no account" survives the merge.
  ADD COLUMN password_hash text;

ALTER TABLE employees
  ADD CONSTRAINT employees_role_valid CHECK (
    role IN ('employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin')
  );

-- Login lower-cases the address before querying, so uniqueness has to be
-- case-insensitive too or Admin@x.com and admin@x.com become two people who
-- look identical on screen. `employees_email_key` was a plain UNIQUE, which
-- would have allowed exactly that once the column started carrying logins.
ALTER TABLE employees DROP CONSTRAINT employees_email_key;
CREATE UNIQUE INDEX employees_email_lower_key ON employees (lower(email));

-- ── carry the existing accounts across ──────────────────────────────────────

-- A login already attached to an employee: move its credentials onto that row.
-- The user's email wins because it is the address that person actually signs in
-- with, and losing it would silently lock them out. Guarded so it cannot
-- collide with another employee's address.
UPDATE employees e
   SET role          = u.role,
       password_hash = u.password_hash,
       email         = CASE
                         WHEN NOT EXISTS (
                           SELECT 1 FROM employees other
                            WHERE other.id <> e.id
                              AND lower(other.email) = lower(u.email)
                         ) THEN u.email
                         ELSE e.email
                       END
  FROM users u
 WHERE u.employee_id = e.id;

-- A login with no HR record — the administrators 0005 allowed for. They become
-- employees, because that is now the only way to exist. The user's id is reused
-- as the employee id so that anything already pointing at it still resolves.
INSERT INTO employees (id, name, email, employee_type, role, password_hash, is_active)
SELECT u.id, u.name, u.email, 'full_time', u.role, u.password_hash, u.is_active
  FROM users u
 WHERE u.employee_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM employees e WHERE lower(e.email) = lower(u.email)
   );

-- ── repoint the one foreign key into users ──────────────────────────────────

-- timeoff_requests.decided_by_user_id is the only reference to `users` in the
-- whole schema. COALESCE handles both shapes above: a linked login resolves to
-- its employee, an unlinked one to the employee row just created with its id.
ALTER TABLE timeoff_requests
  ADD COLUMN decided_by_employee_id uuid REFERENCES employees (id) ON DELETE SET NULL;

UPDATE timeoff_requests r
   SET decided_by_employee_id = COALESCE(u.employee_id, u.id)
  FROM users u
 WHERE r.decided_by_user_id = u.id;

ALTER TABLE timeoff_requests DROP COLUMN decided_by_user_id;

-- ── and the table itself ────────────────────────────────────────────────────

DROP TABLE users;

COMMENT ON COLUMN employees.password_hash IS
  'bcrypt, or NULL for an employee with no login. Never selected by default — repositories list columns explicitly and omit it except when authenticating.';

COMMENT ON COLUMN employees.role IS
  'Authorisation role. Every employee has one; it decides what they may do once signed in.';
