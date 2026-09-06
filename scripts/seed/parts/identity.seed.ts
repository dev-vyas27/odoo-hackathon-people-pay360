/**
 * Logins — one per role, so every permission path can be demonstrated live.
 *
 * Owner: Dev A.
 *
 * Since migration 0010 there is no `users` table: an account IS an employee
 * row, carrying `role` and `password_hash`. Four of the five accounts are
 * therefore ordinary members of the workforce who have been GRANTED a role —
 * the HR Manager is the person in Human Resources whose job title is HR
 * Manager. `people.seed` already created them; this part only adds credentials,
 * and deliberately writes nothing else, because granting somebody a login must
 * not quietly rewrite their HR record.
 *
 * The administrator is the exception and is created here. It operates the
 * system rather than working in it: no department, no post, no bank account,
 * and the employee list filters admins out for that reason.
 *
 * The passwords are deliberately obvious and deliberately identical in shape.
 * This data only ever exists behind `DEMO_SEED_ENABLED`, and a demo where
 * somebody mistypes a generated 24-character hex string on stage is a demo that
 * loses ninety seconds it did not have.
 */
import bcrypt from 'bcryptjs'
import { ROLE_LABELS, type Role } from '@/modules/shared'
import { MAIL_DOMAIN, STAFF } from '../roster'
import type { SeedCredential, SeedPart } from '../types'

interface DemoAccount {
  /** The employee id this login attaches to. */
  id: string
  email: string
  name: string
  role: Role
  password: string
  /** False only for the administrator, whose employee row is created here. */
  existing: boolean
}

const ADMIN_EMAIL = `admin@${MAIL_DOMAIN}`

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: STAFF.admin,
    email: ADMIN_EMAIL,
    name: 'Aarav Menon',
    role: 'admin',
    password: 'admin1234',
    existing: false,
  },
  {
    id: STAFF.hrManager.id,
    email: STAFF.hrManager.email,
    name: STAFF.hrManager.name,
    role: 'hr_manager',
    password: 'hr1234567',
    existing: true,
  },
  {
    id: STAFF.payrollUser.id,
    email: STAFF.payrollUser.email,
    name: STAFF.payrollUser.name,
    role: 'hr_payroll_user',
    password: 'payroll12',
    existing: true,
  },
  {
    id: STAFF.payrollManager.id,
    email: STAFF.payrollManager.email,
    name: STAFF.payrollManager.name,
    role: 'hr_payroll_manager',
    password: 'manager12',
    existing: true,
  },
  {
    /**
     * The protagonist, and the reason row-level scoping is demonstrable: this
     * account sees its own attendance and leave out of a hundred and seventy
     * people's, and nobody else's.
     */
    id: STAFF.employee.id,
    email: STAFF.employee.email,
    name: STAFF.employee.name,
    role: 'employee',
    password: 'employee1',
    existing: true,
  },
]

/**
 * The demo logins, in the order a jury should meet them.
 *
 * Exported for two consumers: the CLI prints them after seeding, and the
 * sign-in screen lists them so an evaluator can pick one. Both read this array,
 * so a password changed here cannot leave a stale copy on screen.
 */
export const DEMO_CREDENTIALS: SeedCredential[] = DEMO_ACCOUNTS.map((account) => ({
  role: ROLE_LABELS[account.role],
  name: account.name,
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
     * TWO batches, not one with a conditional spread. `ctx.upsert` builds a
     * single multi-row INSERT, so every row in a batch has to carry exactly the
     * same columns — a row that omits one throws
     * `Row N of "employees" has different columns from row 0`. That is the
     * right check to have; the shapes here are genuinely different.
     */
    const created = await ctx.upsert(
      'employees',
      DEMO_ACCOUNTS.filter((a) => !a.existing).map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        password_hash: hashes[DEMO_ACCOUNTS.indexOf(account)],
        is_active: true,
        // The row has to satisfy `employee_type NOT NULL` even though this
        // person is not really on the payroll.
        employee_type: 'full_time',
        department_id: null,
        job_position_id: null,
        bank_account: null,
      })),
    )

    /**
     * Granting a role to somebody who already exists is an UPDATE, not an
     * upsert.
     *
     * `INSERT ... ON CONFLICT (id) DO UPDATE` cannot express "set only these
     * two columns": Postgres validates NOT NULL on the proposed row BEFORE it
     * arbitrates the conflict, so a row carrying only `id`, `role` and
     * `password_hash` fails on `name` even though it was never going to be
     * inserted. Restating name and email to get past that would mean this part
     * rewriting HR data it does not own — the exact thing the header says it
     * must not do. An UPDATE says what is meant.
     */
    let granted = 0
    for (const account of DEMO_ACCOUNTS.filter((a) => a.existing)) {
      await ctx.sql(`UPDATE employees SET role = $1, password_hash = $2 WHERE id = $3`, [
        account.role,
        hashes[DEMO_ACCOUNTS.indexOf(account)],
        account.id,
      ])
      granted += 1
    }

    ctx.log(`${created} administrator, ${granted} roles granted to existing staff`)
    for (const account of DEMO_ACCOUNTS) {
      ctx.log(`  ${ROLE_LABELS[account.role].padEnd(20)} ${account.name} — ${account.email}`)
    }
  },
}
