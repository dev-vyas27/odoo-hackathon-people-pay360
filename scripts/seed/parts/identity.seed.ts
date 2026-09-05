/**
 * Logins — one per role, so every permission path can be demonstrated live.
 *
 * Owner: Dev A.
 *
 * Since migration 0010 there is no `users` table: an account IS an employee
 * row, carrying `role` and `password_hash`. So this part no longer inserts
 * users; it does two things instead:
 *
 *   1. Attaches credentials to an employee `people.seed` already created —
 *      that is the `employee` role, and it is what makes row-level scoping
 *      demonstrable (this account sees its own attendance and leave, nobody
 *      else's).
 *   2. Creates employee rows for the staff roles, because an administrator has
 *      to exist as a person now. Their ids are the old `SEED.users.*` values,
 *      unchanged, so `timeoff.seed`'s `decided_by_employee_id` still resolves.
 *
 * It must run AFTER `people.seed` for the same reason it always did: the
 * employee it attaches to has to exist first.
 *
 * The passwords are deliberately obvious and deliberately identical in shape.
 * This data only ever exists behind `DEMO_SEED_ENABLED`, and a demo where
 * somebody mistypes a generated 24-character hex string on stage is a demo that
 * loses ninety seconds it did not have.
 */
import bcrypt from 'bcryptjs'
import { ROLE_LABELS, type Role } from '@/modules/shared'
import { SEED } from '../ids'
import type { SeedCredential, SeedPart } from '../types'

interface DemoAccount {
  /** The employee id. For staff roles this row is created here. */
  id: string
  email: string
  name: string
  role: Role
  password: string
  /** True when `people.seed` already created this employee. */
  existing: boolean
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: SEED.users.admin,
    email: 'admin@peoplepay360.dev',
    name: 'Aarav Admin',
    role: 'admin',
    password: 'admin1234',
    existing: false,
  },
  {
    id: SEED.users.hrManager,
    email: 'hr@peoplepay360.dev',
    name: 'Meera HR',
    role: 'hr_manager',
    password: 'hr1234567',
    existing: false,
  },
  {
    id: SEED.users.payrollUser,
    email: 'payroll.user@peoplepay360.dev',
    name: 'Rohan Payroll',
    role: 'hr_payroll_user',
    password: 'payroll12',
    existing: false,
  },
  {
    id: SEED.users.payrollManager,
    email: 'payroll.manager@peoplepay360.dev',
    name: 'Divya Finance',
    role: 'hr_payroll_manager',
    password: 'manager12',
    existing: false,
  },
  {
    /**
     * The protagonist. `people.seed` created this row, so the login address is
     * that employee's own email — there is no separate account address to sign
     * in with any more, which is the whole point of the merge.
     */
    id: SEED.employees.demoLead,
    email: 'priya.sharma@peoplepay360.dev',
    name: 'Priya Sharma',
    role: 'employee',
    password: 'employee1',
    existing: true,
  },
]

export const DEMO_CREDENTIALS: SeedCredential[] = DEMO_ACCOUNTS.map((account) => ({
  role: ROLE_LABELS[account.role],
  email: account.email,
  password: account.password,
}))

export const identitySeed: SeedPart = {
  name: 'identity',
  /**
   * Empty on purpose. This part writes to `employees`, which `people.seed`
   * already lists — naming it again would have `--reset` delete the same table
   * twice, and in an order that no longer matches the dependency graph.
   */
  tables: [],
  async run(ctx) {
    /**
     * bcrypt at cost 10 is ~60ms per hash and these run in parallel rather than
     * in a loop — five sequential hashes is a third of a second of dead time on
     * a button a judge is watching.
     */
    const hashes = await Promise.all(
      DEMO_ACCOUNTS.map((account) => bcrypt.hash(account.password, 10)),
    )

    /**
     * Keys are COLUMN names, not domain field names. The seed writes rows, so
     * it speaks the database's snake_case rather than the application's
     * camelCase — there is no repository in between to translate.
     *
     * TWO batches, not one with a conditional spread. `ctx.upsert` builds a
     * single multi-row INSERT, so every row in a batch has to carry exactly the
     * same columns — a row that omits one throws
     * `Row N of "employees" has different columns from row 0`. That is the
     * right check to have; the shapes here are genuinely different.
     */

    // Staff roles: these people do not exist yet, so the row has to satisfy
    // `employee_type NOT NULL`.
    const created = await ctx.upsert(
      'employees',
      DEMO_ACCOUNTS.filter((a) => !a.existing).map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        password_hash: hashes[DEMO_ACCOUNTS.indexOf(account)],
        is_active: true,
        employee_type: 'full_time',
      })),
    )

    /**
     * Already-seeded employees: credentials only. Deliberately no
     * `employee_type`, `department_id` or anything else `people.seed` owns —
     * granting somebody a login must not quietly rewrite their HR record.
     */
    const granted = await ctx.upsert(
      'employees',
      DEMO_ACCOUNTS.filter((a) => a.existing).map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        password_hash: hashes[DEMO_ACCOUNTS.indexOf(account)],
        is_active: true,
      })),
    )

    ctx.log(`${created + granted} accounts (one per role)`)
  },
}
