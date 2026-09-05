/**
 * Departments, schedules, job positions and a handful of employees.
 *
 * ── Dev B: this file is yours to replace. ───────────────────────────────────
 *
 * It exists because foreign keys are real now. Under Mongo, my allocations
 * could reference `SEED.employees.demoLead` whether or not that employee
 * existed. In Postgres that is a constraint violation, so identity and timeoff
 * cannot seed at all until something has put employees in the table.
 *
 * So this is the minimum that makes the schema satisfiable — enough to
 * demonstrate the app, nowhere near the ~25 employees with 60 days of
 * attendance the plan calls for. Overwrite it wholesale when you build
 * `modules/people`; keep the ids from `SEED`, because identity and timeoff
 * point at them.
 */
import { SEED, seedId } from '../ids'
import type { SeedPart } from '../types'

export const peopleSeed: SeedPart = {
  name: 'people',
  // Parents first; --reset empties them in reverse. See SeedPart.tables.
  tables: [
    'departments',
    'job_positions',
    'working_schedules',
    'working_schedule_days',
    'employees',
  ],
  async run(ctx) {
    const departments = await ctx.upsert('departments', [
      { id: SEED.departments.engineering, name: 'Engineering', code: 'ENG', is_active: true },
      { id: SEED.departments.sales, name: 'Sales', code: 'SLS', is_active: true },
      { id: SEED.departments.operations, name: 'Operations', code: 'OPS', is_active: true },
      // Where the HR and payroll logins sit — see identity.seed.
      { id: SEED.departments.humanResources, name: 'Human Resources', code: 'HR', is_active: true },
    ])
    ctx.log(`${departments} departments`)

    const schedules = await ctx.upsert('working_schedules', [
      { id: SEED.schedules.standard40, name: 'Standard 40h', weekly_hours: 40, is_active: true },
      { id: SEED.schedules.partTime20, name: 'Part-time 20h', weekly_hours: 20, is_active: true },
    ])
    ctx.log(`${schedules} working schedules`)

    /**
     * Monday to Friday, 09:00-18:00 with an hour for lunch = 8 worked hours a
     * day, 40 a week. `weekly_hours` above is that sum — Dev B's
     * weekly-hours.service.ts computes it rather than trusting this literal.
     */
    const days = await ctx.upsert(
      'working_schedule_days',
      [1, 2, 3, 4, 5].flatMap((day) => [
        {
          id: seedId('sch', 100 + day),
          working_schedule_id: SEED.schedules.standard40,
          day_of_week: day,
          starts_at: '09:00',
          ends_at: '18:00',
          break_minutes: 60,
        },
        {
          id: seedId('sch', 200 + day),
          working_schedule_id: SEED.schedules.partTime20,
          day_of_week: day,
          starts_at: '09:00',
          ends_at: '13:00',
          break_minutes: 0,
        },
      ]),
    )
    ctx.log(`${days} schedule day rows`)

    const positions = await ctx.upsert('job_positions', [
      { id: seedId('job', 1), name: 'Software Engineer', department_id: SEED.departments.engineering, is_active: true },
      { id: seedId('job', 2), name: 'Engineering Manager', department_id: SEED.departments.engineering, is_active: true },
      { id: seedId('job', 3), name: 'Account Executive', department_id: SEED.departments.sales, is_active: true },
      { id: seedId('job', 4), name: 'Operations Analyst', department_id: SEED.departments.operations, is_active: true },
      // The posts held by the staff logins in identity.seed.
      { id: seedId('job', 5), name: 'HR Manager', department_id: SEED.departments.humanResources, is_active: true },
      { id: seedId('job', 6), name: 'Payroll Specialist', department_id: SEED.departments.humanResources, is_active: true },
      { id: seedId('job', 7), name: 'Payroll Manager', department_id: SEED.departments.humanResources, is_active: true },
    ])
    ctx.log(`${positions} job positions`)

    /**
     * Employee 3 is inserted first and manages the other two, because
     * `manager_id` is a self-referencing foreign key: a manager must already
     * exist as a row before anyone can point at them.
     */
    const employees = await ctx.upsert('employees', [
      {
        id: seedId('emp', 3),
        name: 'Kavya Nair',
        email: 'kavya.nair@peoplepay360.dev',
        phone: '+91 98200 11003',
        department_id: SEED.departments.engineering,
        job_position_id: seedId('job', 2),
        manager_id: null,
        working_schedule_id: SEED.schedules.standard40,
        employee_type: 'full_time',
        bank_account: 'HDFC0001234567890',
        is_active: true,
      },
      {
        // The demo's protagonist, and the employee linked to the `employee`
        // role login — which is what makes row-level scoping demonstrable.
        id: SEED.employees.demoLead,
        name: 'Priya Sharma',
        email: 'priya.sharma@peoplepay360.dev',
        phone: '+91 98200 11001',
        department_id: SEED.departments.engineering,
        job_position_id: seedId('job', 1),
        manager_id: seedId('emp', 3),
        working_schedule_id: SEED.schedules.standard40,
        employee_type: 'full_time',
        bank_account: 'HDFC0009876543210',
        is_active: true,
      },
      {
        // Dev B: this is the one that must end up with an expired contract AND
        // a current one. That pair is what proves period-based contract
        // selection live on stage.
        id: SEED.employees.twoContracts,
        name: 'Rahul Verma',
        email: 'rahul.verma@peoplepay360.dev',
        phone: '+91 98200 11002',
        department_id: SEED.departments.sales,
        job_position_id: seedId('job', 3),
        manager_id: seedId('emp', 3),
        working_schedule_id: SEED.schedules.standard40,
        employee_type: 'full_time',
        bank_account: 'ICIC0004455667788',
        is_active: true,
      },
      {
        // No bank account on purpose: this is what makes Dev C's
        // missing-bank-details warning fire during the payrun demo.
        id: seedId('emp', 4),
        name: 'Ananya Iyer',
        email: 'ananya.iyer@peoplepay360.dev',
        phone: '+91 98200 11004',
        department_id: SEED.departments.operations,
        job_position_id: seedId('job', 4),
        manager_id: seedId('emp', 3),
        working_schedule_id: SEED.schedules.partTime20,
        employee_type: 'part_time',
        bank_account: null,
        is_active: true,
      },
      {
        id: seedId('emp', 5),
        name: 'Vikram Desai',
        email: 'vikram.desai@peoplepay360.dev',
        phone: '+91 98200 11005',
        department_id: SEED.departments.engineering,
        job_position_id: seedId('job', 1),
        manager_id: seedId('emp', 3),
        working_schedule_id: SEED.schedules.standard40,
        employee_type: 'intern',
        bank_account: 'SBIN0001122334455',
        is_active: true,
      },
    ])
    ctx.log(`${employees} employees (Dev B: replace with the full set)`)

    // Departments got their manager FK in migration 0004, once employees
    // existed. Same ordering problem, same solution: fill it in afterwards.
    await ctx.sql(
      `UPDATE departments SET manager_id = $1 WHERE id = $2`,
      [seedId('emp', 3), SEED.departments.engineering],
    )
  },
}
