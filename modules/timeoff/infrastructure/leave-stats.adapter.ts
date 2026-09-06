/**
 * `LeaveStatsPort` — what Time Off publishes to the Payroll Dashboard.
 *
 * Spec B9 asks the dashboard for "Approved Time Off" as a KPI and "approved
 * days, pending requests, and leave balances" in the Time Off overview. This is
 * the only surface through which `analytics` gets them; it never touches these
 * tables directly.
 *
 * The aggregation is SQL rather than "load every row and sum in JavaScript",
 * because the dashboard asks for a whole company across a period and that is
 * exactly the shape of query a database is for.
 */
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
  /**
   * Approved leave falling inside the period.
   *
   * Note it counts the OVERLAP, not the whole request: a 10-day leave that
   * straddles a month boundary contributes only the days actually inside the
   * period, otherwise March's dashboard would bill days taken in April.
   *
   * The filter is applied by joining employees — a table this module does
   * not own. It is read-only and only in this reporting query, which is the
   * pragmatic line: a port round trip per employee would be an N+1 on the one
   * screen where performance is visible.
   */
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

  /**
   * The "pending requests" figure on the dashboard, and the approver's queue.
   *
   * Filtered like every other dashboard metric: an unfiltered count sitting
   * beside filtered KPIs reads as "this department has 40 requests waiting"
   * when 40 is the company's total.
   */
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

  /**
   * Leave balances aggregated across the employee population matched by
   * `filter`, one row per leave type that requires an allocation — the shape
   * the dashboard's Time Off overview table already renders (allocated,
   * taken, pending, remaining), just totalled over many employees instead of
   * one.
   *
   * Two grouped queries rather than one join: allocations and pending
   * requests are two different one-to-many relationships off the same leave
   * type, and joining both in a single query would multiply rows across each
   * other and double-count. Aggregating each independently and merging with
   * the pure, unit-tested `buildBalanceTotals` avoids that without giving up
   * doing the summing in SQL.
   *
   * `departmentIds`/`employeeType` are applied by joining `employees` — a
   * table this module does not own — the same pragmatic, read-only exception
   * used by `approvedInPeriod` above.
   */
  async balanceTotals(filter: StatsFilter, on: Date): Promise<LeaveBalanceView[]> {
    const types = new PostgresTimeOffTypeRepository()
    // Types that need no allocation have no balance to report — mirrors
    // `GetBalanceUseCase`'s own filtering so the two screens cannot disagree
    // about which leave types even carry a balance.
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
