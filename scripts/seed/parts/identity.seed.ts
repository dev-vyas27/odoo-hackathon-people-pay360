/**
 * Users — one per role, so every permission path can be demonstrated live.
 *
 * Owner: Dev A.
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

interface DemoUser {
  id: string
  email: string
  name: string
  role: Role
  password: string
  employeeId: string | null
}

const DEMO_USERS: DemoUser[] = [
  {
    id: SEED.users.admin,
    email: 'admin@peoplepay360.dev',
    name: 'Aarav Admin',
    role: 'admin',
    password: 'admin1234',
    employeeId: null,
  },
  {
    id: SEED.users.hrManager,
    email: 'hr@peoplepay360.dev',
    name: 'Meera HR',
    role: 'hr_manager',
    password: 'hr1234567',
    employeeId: null,
  },
  {
    id: SEED.users.payrollUser,
    email: 'payroll.user@peoplepay360.dev',
    name: 'Rohan Payroll',
    role: 'hr_payroll_user',
    password: 'payroll12',
    employeeId: null,
  },
  {
    id: SEED.users.payrollManager,
    email: 'payroll.manager@peoplepay360.dev',
    name: 'Divya Finance',
    role: 'hr_payroll_manager',
    password: 'manager12',
    employeeId: null,
  },
  {
    /**
     * The only user linked to an employee record. That link is what makes
     * row-level scoping demonstrable: this account can read its own attendance
     * and leave, and nobody else's.
     */
    id: SEED.users.employee,
    email: 'employee@peoplepay360.dev',
    name: 'Priya Sharma',
    role: 'employee',
    password: 'employee1',
    employeeId: SEED.employees.demoLead,
  },
]

export const DEMO_CREDENTIALS: SeedCredential[] = DEMO_USERS.map((user) => ({
  role: ROLE_LABELS[user.role],
  email: user.email,
  password: user.password,
}))

export const identitySeed: SeedPart = {
  name: 'identity',
  tables: ['users'],
  async run(ctx) {
    /**
     * bcrypt at cost 10 is ~60ms per hash and these run in parallel rather than
     * in a loop — five sequential hashes is a third of a second of dead time on
     * a button a judge is watching.
     */
    const hashes = await Promise.all(DEMO_USERS.map((user) => bcrypt.hash(user.password, 10)))

    /**
     * Keys are COLUMN names, not domain field names. The seed writes rows, so
     * it speaks the database's snake_case rather than the application's
     * camelCase — there is no repository in between to translate.
     */
    const count = await ctx.upsert(
      'users',
      DEMO_USERS.map((user, i) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        employee_id: user.employeeId,
        password_hash: hashes[i],
        is_active: true,
      })),
    )

    ctx.log(`${count} users (one per role)`)
  },
}
