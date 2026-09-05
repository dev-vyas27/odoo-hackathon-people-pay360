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
import { Period, startOfDay, type LeaveBalanceView, type LeaveStatsPort } from '@/modules/shared'
import { buildBalances } from '../domain/balance.service'
import { REQUESTS_TABLE, toDateString } from './timeoff.tables'
import {
  PostgresAllocationRepository,
  PostgresLeaveRequestRepository,
  PostgresTimeOffTypeRepository,
} from './timeoff.repositories'

export class PostgresLeaveStatsAdapter implements LeaveStatsPort {
  /**
   * Approved leave falling inside the period.
   *
   * Note it counts the OVERLAP, not the whole request: a 10-day leave that
   * straddles a month boundary contributes only the days actually inside the
   * period, otherwise March's dashboard would bill days taken in April.
   *
   * `departmentIds` is applied by joining employees — a table this module does
   * not own. It is read-only and only in this reporting query, which is the
   * pragmatic line: a port round trip per employee would be an N+1 on the one
   * screen where performance is visible.
   */
  async approvedInPeriod(period: Period, departmentIds?: string[]): Promise<number> {
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
          AND ($3::uuid[] IS NULL OR e.department_id = ANY($3))`,
      [toDateString(period.start), toDateString(period.end), departmentIds ?? null],
    )

    return Math.round(Number(rows[0]?.total ?? 0) * 100) / 100
  }

  /** The "pending requests" figure on the dashboard, and the approver's queue. */
  async pendingCount(): Promise<number> {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "${REQUESTS_TABLE}" WHERE status = 'to_approve'`,
    )
    return rows[0]?.count ?? 0
  }

  /**
   * One employee's balances. Delegates to the same pure `buildBalances` the
   * Time Off screens use, so the dashboard cannot disagree with the balance
   * page about how much leave someone has left.
   */
  async balancesFor(employeeId: string, on: Date): Promise<LeaveBalanceView[]> {
    const types = new PostgresTimeOffTypeRepository()
    const allocations = new PostgresAllocationRepository()
    const requests = new PostgresLeaveRequestRepository()

    const [allTypes, employeeAllocations, employeeRequests] = await Promise.all([
      types.findAll(true),
      allocations.findForEmployee(employeeId),
      requests.findForEmployee(employeeId),
    ])

    return buildBalances(
      allTypes.filter((t) => t.requiresAllocation),
      employeeAllocations,
      employeeRequests,
      startOfDay(on),
    )
  }
}
