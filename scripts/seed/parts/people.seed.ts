

import { SEED, seedId } from '../ids'
import {
  DEPARTMENT_HEADS,
  DEPARTMENT_SPECS,
  POSTS,
  ROSTER,
  SCHEDULES,
  type DepartmentKey,
} from '../roster'
import type { SeedPart } from '../types'

const DEPARTMENT_ID: Record<DepartmentKey, string> = {
  engineering: SEED.departments.engineering,
  sales: SEED.departments.sales,
  operations: SEED.departments.operations,
  humanResources: SEED.departments.humanResources,
  product: seedId('dep', 5),
  marketing: seedId('dep', 6),
  success: seedId('dep', 7),
  finance: seedId('dep', 8),
}

export { DEPARTMENT_ID }

export const peopleSeed: SeedPart = {
  name: 'people',
  
  tables: [
    'departments',
    'job_positions',
    'working_schedules',
    'working_schedule_days',
    'employees',
  ],
  async run(ctx) {
    const departments = await ctx.upsert(
      'departments',
      DEPARTMENT_SPECS.map((department) => ({
        id: DEPARTMENT_ID[department.key],
        name: department.name,
        code: department.code,
        is_active: true,
      })),
    )
    ctx.log(`${departments} departments`)

    

    const schedules = await ctx.upsert('working_schedules', [
      { id: SCHEDULES.standard40, name: 'Standard 40h', weekly_hours: 40, is_active: true },
      { id: SCHEDULES.compressed36, name: 'Compressed 36h (Mon–Thu)', weekly_hours: 36, is_active: true },
      { id: SCHEDULES.intern30, name: 'Intern 30h', weekly_hours: 30, is_active: true },
      { id: SCHEDULES.partTime20, name: 'Part-time 20h', weekly_hours: 20, is_active: true },
    ])
    ctx.log(`${schedules} working schedules`)

    const dayRows: Array<{
      schedule: string
      days: number[]
      startsAt: string
      endsAt: string
      breakMinutes: number
      offset: number
    }> = [
      
      { schedule: SCHEDULES.standard40, days: [1, 2, 3, 4, 5], startsAt: '09:00', endsAt: '18:00', breakMinutes: 60, offset: 100 },
      
      { schedule: SCHEDULES.compressed36, days: [1, 2, 3, 4], startsAt: '09:00', endsAt: '19:00', breakMinutes: 60, offset: 300 },
      
      { schedule: SCHEDULES.intern30, days: [1, 2, 3, 4, 5], startsAt: '10:00', endsAt: '17:00', breakMinutes: 60, offset: 400 },
      
      { schedule: SCHEDULES.partTime20, days: [1, 2, 3, 4, 5], startsAt: '09:00', endsAt: '13:00', breakMinutes: 0, offset: 200 },
    ]

    const days = await ctx.upsert(
      'working_schedule_days',
      dayRows.flatMap((row) =>
        row.days.map((day) => ({
          id: seedId('sch', row.offset + day),
          working_schedule_id: row.schedule,
          day_of_week: day,
          starts_at: row.startsAt,
          ends_at: row.endsAt,
          break_minutes: row.breakMinutes,
        })),
      ),
    )
    ctx.log(`${days} schedule day rows across 4 patterns`)

    const positions = await ctx.upsert(
      'job_positions',
      POSTS.map((post, i) => ({
        id: seedId('job', i + 1),
        name: post.title,
        department_id: DEPARTMENT_ID[post.departmentKey],
        is_active: true,
      })),
    )
    ctx.log(`${positions} job positions`)

    
    const employees = await ctx.upsert(
      'employees',
      ROSTER.map((person) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        department_id: DEPARTMENT_ID[person.departmentKey],
        job_position_id: seedId('job', person.jobIndex),
        working_schedule_id: person.scheduleId,
        employee_type: person.employeeType,
        bank_account: person.bankAccount,
        is_active: person.isActive,
      })),
    )
    ctx.log(`${employees} employees (${ROSTER.filter((p) => !p.isActive).length} archived)`)

    

    const links = ROSTER.filter((person) => person.managerId)
    if (links.length > 0) {
      const values: string[] = []
      const params: unknown[] = []
      for (const person of links) {
        params.push(person.id, person.managerId)
        values.push(`($${params.length - 1}::uuid, $${params.length}::uuid)`)
      }
      await ctx.sql(
        `UPDATE employees AS e
            SET manager_id = v.manager_id
           FROM (VALUES ${values.join(', ')}) AS v(employee_id, manager_id)
          WHERE e.id = v.employee_id`,
        params,
      )
    }
    ctx.log(`${links.length} reporting lines`)

    
    
    for (const [key, headId] of Object.entries(DEPARTMENT_HEADS)) {
      await ctx.sql(`UPDATE departments SET manager_id = $1 WHERE id = $2`, [
        headId,
        DEPARTMENT_ID[key as DepartmentKey],
      ])
    }
    ctx.log(`${Object.keys(DEPARTMENT_HEADS).length} department heads assigned`)
  },
}
