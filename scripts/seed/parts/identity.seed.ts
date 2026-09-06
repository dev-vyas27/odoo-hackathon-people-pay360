


import bcrypt from 'bcryptjs'
import { ROLE_LABELS, type Role } from '@/modules/shared'
import { MAIL_DOMAIN, STAFF } from '../roster'
import type { SeedCredential, SeedPart } from '../types'

interface DemoAccount {
  
  id: string
  email: string
  name: string
  role: Role
  password: string
  
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
    


    id: STAFF.employee.id,
    email: STAFF.employee.email,
    name: STAFF.employee.name,
    role: 'employee',
    password: 'employee1',
    existing: true,
  },
]



export const DEMO_CREDENTIALS: SeedCredential[] = DEMO_ACCOUNTS.map((account) => ({
  role: ROLE_LABELS[account.role],
  name: account.name,
  email: account.email,
  password: account.password,
}))

export const identitySeed: SeedPart = {
  name: 'identity',
  


  tables: [],
  async run(ctx) {
    


    const hashes = await Promise.all(
      DEMO_ACCOUNTS.map((account) => bcrypt.hash(account.password, 10)),
    )

    


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
        department_id: null,
        job_position_id: null,
        bank_account: null,
      })),
    )

    


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
