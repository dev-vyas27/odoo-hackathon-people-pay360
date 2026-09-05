/**
 * Time off types, allocations and a realistic mix of requests.
 *
 * Owner: Dev A.
 *
 * Dates are anchored to the CURRENT year rather than a hardcoded one. A demo
 * whose leave balances all expired last year looks broken; the ids stay fixed,
 * so the seed is still idempotent even though the dates move.
 */
import { SEED, seedId } from '../ids'
import type { SeedPart } from '../types'

/** `date` columns take 'YYYY-MM-DD'. No time, no zone, no ambiguity. */
const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`

export const timeoffSeed: SeedPart = {
  name: 'timeoff',
  // Parents first; --reset empties them in reverse. See SeedPart.tables.
  tables: ['timeoff_types', 'timeoff_allocations', 'timeoff_requests'],
  async run(ctx) {
    const year = new Date().getUTCFullYear()

    const types = await ctx.upsert('timeoff_types', [
      {
        id: SEED.timeOffTypes.paid,
        name: 'Paid Time Off',
        code: 'PL',
        unit: 'day',
        requires_allocation: true,
        is_paid: true,
        is_active: true,
      },
      {
        id: SEED.timeOffTypes.sick,
        name: 'Sick Leave',
        code: 'SL',
        unit: 'day',
        requires_allocation: true,
        is_paid: true,
        is_active: true,
      },
      {
        /**
         * The interesting one: no allocation, so it can never overdraw, and
         * unpaid, so payroll prorates against it. It is the counter-example
         * that proves the flags do something.
         */
        id: SEED.timeOffTypes.unpaid,
        name: 'Unpaid Leave',
        code: 'UL',
        unit: 'day',
        requires_allocation: false,
        is_paid: false,
        is_active: true,
      },
    ])
    ctx.log(`${types} leave types`)

    const employees = [SEED.employees.demoLead, SEED.employees.twoContracts]

    const allocations = await ctx.upsert(
      'timeoff_allocations',
      employees.flatMap((employeeId, index) => [
        {
          id: seedId('alc', index * 2 + 1),
          employee_id: employeeId,
          timeoff_type_id: SEED.timeOffTypes.paid,
          unit: 'day',
          allocated: 18,
          // Pre-consumed so the balance screen shows movement rather than a
          // suspiciously untouched round number. Matches the 5-day approved
          // request below — the CHECK constraint would reject an inconsistent
          // pair, which is exactly the safety net we wanted.
          taken: index === 0 ? 5 : 0,
          valid_from: day(year, 1, 1),
          valid_to: day(year, 12, 31),
          status: 'approved',
          note: 'Annual entitlement',
        },
        {
          id: seedId('alc', index * 2 + 2),
          employee_id: employeeId,
          timeoff_type_id: SEED.timeOffTypes.sick,
          unit: 'day',
          allocated: 8,
          taken: 0,
          valid_from: day(year, 1, 1),
          valid_to: day(year, 12, 31),
          status: 'approved',
          note: 'Statutory sick leave',
        },
      ]),
    )
    ctx.log(`${allocations} allocations`)

    const requests = await ctx.upsert('timeoff_requests', [
      {
        // Approved, and its 5 days are exactly the `taken: 5` above.
        id: seedId('lvr', 1),
        employee_id: SEED.employees.demoLead,
        timeoff_type_id: SEED.timeOffTypes.paid,
        starts_on: day(year, 3, 2),
        ends_on: day(year, 3, 6),
        unit: 'day',
        duration: 5,
        reason: 'Family holiday',
        status: 'approved',
        allocation_id: seedId('alc', 1),
        decided_by_employee_id: SEED.users.hrManager,
        decided_at: new Date(Date.UTC(year, 1, 20)),
      },
      {
        // Pending, so the approval flow has something to demonstrate on.
        id: seedId('lvr', 2),
        employee_id: SEED.employees.demoLead,
        timeoff_type_id: SEED.timeOffTypes.paid,
        starts_on: day(year, 8, 10),
        ends_on: day(year, 8, 12),
        unit: 'day',
        duration: 3,
        reason: 'Personal',
        status: 'to_approve',
        allocation_id: null,
        decided_by_employee_id: null,
        decided_at: null,
      },
      {
        id: seedId('lvr', 3),
        employee_id: SEED.employees.twoContracts,
        timeoff_type_id: SEED.timeOffTypes.sick,
        starts_on: day(year, 5, 14),
        ends_on: day(year, 5, 14),
        unit: 'day',
        duration: 1,
        reason: 'Fever',
        status: 'to_approve',
        allocation_id: null,
        decided_by_employee_id: null,
        decided_at: null,
      },
      {
        // Refused, so the list shows all three outcomes and every status badge
        // colour is visible in one screenshot.
        id: seedId('lvr', 4),
        employee_id: SEED.employees.twoContracts,
        timeoff_type_id: SEED.timeOffTypes.unpaid,
        starts_on: day(year, 6, 1),
        ends_on: day(year, 6, 30),
        unit: 'day',
        duration: 30,
        reason: 'Sabbatical request',
        status: 'refused',
        allocation_id: null,
        decided_by_employee_id: SEED.users.hrManager,
        decided_at: new Date(Date.UTC(year, 4, 20)),
      },
    ])
    ctx.log(`${requests} leave requests (approved, pending and refused)`)
  },
}
