


import { query } from '@/lib/db'
import {
  Period,
  startOfDay,
  type LeaveBalanceView,
  type LeaveStatsPort,
  type StatsFilter,
} from '@/modules/shared'
import { buildBalanceTotals } from '../domain/balance.service'
import { ALLOCATIONS_TABLE, REQUESTS_TABLE, toDateString } from './timeoff.tables'
import { PostgresTimeOffTypeRepository } from './timeoff.repositories'

export class PostgresLeaveStatsAdapter implements LeaveStatsPort {
  


  async approvedInPeriod(period: Period, filter: StatsFilter = {}): Promise<number> {
    const rows = await query<{ total: number | null }>(
      `SELECT COALESCE(SUM(
                -- Days of this request that fall inside the window, inclusive.
                (LEAST(r.ends_on, $2::date) - GREATEST(r.starts_on, $1::date) + 1)
                -- Scale by the request's own day-rate, so a half-day stays half.
                * (r.duration / NULLIF(r.ends_on - r.starts_on + 1, 0))
              ), 0)::numeric AS total
         FROM "${REQUESTS_TABLE}" r
         JOIN employees e ON e.id = r.employee_id
        WHERE r.status = 'approved'
          AND r.starts_on <= $2::date
          AND r.ends_on   >= $1::date
          AND ($3::uuid IS NULL OR e.department_id = $3)
          AND ($4::text IS NULL OR e.employee_type = $4)`,
      [
        toDateString(period.start),
        toDateString(period.end),
        filter.departmentId ?? null,
        filter.employeeType ?? null,
      ],
    )

    return Math.round(Number(rows[0]?.total ?? 0) * 100) / 100
  }

  


  async pendingCount(filter: StatsFilter = {}): Promise<number> {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM "${REQUESTS_TABLE}" r
         JOIN employees e ON e.id = r.employee_id
        WHERE r.status = 'to_approve'
          AND ($1::uuid IS NULL OR e.department_id = $1)
          AND ($2::text IS NULL OR e.employee_type = $2)`,
      [filter.departmentId ?? null, filter.employeeType ?? null],
    )
    return rows[0]?.count ?? 0
  }

  


  async balanceTotals(filter: StatsFilter, on: Date): Promise<LeaveBalanceView[]> {
    const types = new PostgresTimeOffTypeRepository()
    
    
    
    const balanceTypes = (await types.findAll(true)).filter((t) => t.requiresAllocation)
    if (balanceTypes.length === 0) return []

    const onDate = toDateString(startOfDay(on))
    const filterValues: unknown[] = [filter.departmentId ?? null, filter.employeeType ?? null]

    const [allocationRows, pendingRows] = await Promise.all([
      query<{ timeoff_type_id: string; allocated: number; taken: number }>(
        `SELECT a.timeoff_type_id,
                COALESCE(SUM(a.allocated), 0) AS allocated,
                COALESCE(SUM(a.taken), 0)     AS taken
           FROM "${ALLOCATIONS_TABLE}" a
           JOIN employees e ON e.id = a.employee_id
          -- Only a USABLE allocation counts toward the liability: approved
          -- (Allocation.isUsable), and valid ON the reference date -- the same
          -- two conditions buildBalances's activeOn predicate applies for one
          -- employee, mirrored here in SQL rather than reinvented.
          WHERE a.status = 'approved'
            AND a.valid_from <= $1::date
            AND a.valid_to   >= $1::date
            AND ($2::uuid IS NULL OR e.department_id = $2)
            AND ($3::text IS NULL OR e.employee_type = $3)
          GROUP BY a.timeoff_type_id`,
        [onDate, ...filterValues],
      ),
      query<{ timeoff_type_id: string; pending: number }>(
        `SELECT r.timeoff_type_id,
                COALESCE(SUM(r.duration), 0) AS pending
           FROM "${REQUESTS_TABLE}" r
           JOIN employees e ON e.id = r.employee_id
          WHERE r.status = 'to_approve'
            AND ($1::uuid IS NULL OR e.department_id = $1)
            AND ($2::text IS NULL OR e.employee_type = $2)
          GROUP BY r.timeoff_type_id`,
        filterValues,
      ),
    ])

    return buildBalanceTotals(
      balanceTypes,
      allocationRows.map((r) => ({
        timeOffTypeId: r.timeoff_type_id,
        allocated: Number(r.allocated),
        taken: Number(r.taken),
      })),
      pendingRows.map((r) => ({
        timeOffTypeId: r.timeoff_type_id,
        pending: Number(r.pending),
      })),
    )
  }
}
