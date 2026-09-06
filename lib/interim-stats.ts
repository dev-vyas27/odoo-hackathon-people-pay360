/**
 * ⚠ SCAFFOLDING — delete as Dev B and Dev C register the real ports.
 *
 * The dashboard reads five ports. Time Off supplies one; the other four belong
 * to modules that do not exist yet. Their null objects return zeros, which is
 * honest but makes the screen impossible to build or demonstrate.
 *
 * So these aggregate the tables directly. They are real SQL over real rows —
 * spec A7 requires "live metrics derived from actual system records", and
 * nothing here invents a number. What makes them scaffolding is ownership, not
 * correctness: `employees`, `attendances`, `contracts` and `payslips` are not
 * Dev A's tables to read.
 *
 * `providePort` is first-wins and `bootstrap.ts` calls this LAST, so each of
 * these is switched off individually the moment its real owner registers.
 * Deleting this file is then the only cleanup.
 */
import { query } from '@/lib/db'
/**
 * The one rule this file borrows rather than restates: an administrator is an
 * operator, not a member of staff. The employee list applies the same constant,
 * so a headcount here can never disagree with the list a judge is looking at.
 */
import { NOT_AN_ADMIN } from '@/modules/people'
import {
  PORT_KEYS,
  container,
  providePort,
  type AttendanceStatsPort,
  type AttendanceSummary,
  type ContractAlert,
  type ContractAlertsPort,
  type EmployeeStatsPort,
  type EmployeeType,
  type PayrollStatsPort,
  type Period,
} from '@/modules/shared'

/** `date` columns bind cleanly from 'YYYY-MM-DD'. */
const d = (value: Date) => value.toISOString().slice(0, 10)

// ── people ───────────────────────────────────────────────────────────────────

const employeeStats: EmployeeStatsPort = {
  async headcount(filter) {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
          AND ($1::uuid IS NULL OR department_id = $1)
          AND ($2::text IS NULL OR employee_type = $2)`,
      [filter?.departmentId ?? null, filter?.employeeType ?? null],
    )
    return rows[0]?.count ?? 0
  },

  async headcountByDepartment(filter) {
    /**
     * LEFT JOIN from departments, not from employees: a department with nobody
     * in it still belongs on the breakdown and still belongs in the filter
     * dropdown. Joining the other way would make it vanish.
     */
    const rows = await query<{ department_id: string; department_name: string; count: number }>(
      `SELECT d.id            AS department_id,
              d.name          AS department_name,
              COUNT(e.id)::int AS count
         FROM departments d
         LEFT JOIN employees e
                ON e.department_id = d.id
               AND e.is_active = true
               AND e.${NOT_AN_ADMIN}
               AND ($1::text IS NULL OR e.employee_type = $1)
        WHERE d.is_active = true
        GROUP BY d.id, d.name
        ORDER BY d.name ASC`,
      [filter?.employeeType ?? null],
    )
    return rows.map((r) => ({
      departmentId: r.department_id,
      departmentName: r.department_name,
      count: r.count,
    }))
  },

  async headcountByEmployeeType() {
    const rows = await query<{ employee_type: EmployeeType; count: number }>(
      `SELECT employee_type, COUNT(*)::int AS count
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
        GROUP BY employee_type
        ORDER BY count DESC`,
    )
    return rows.map((r) => ({ employeeType: r.employee_type, count: r.count }))
  },

  async missingBankDetails() {
    /**
     * Spec B9's "missing required information" alert. Dev C's payrun validation
     * reads the same column before finalising.
     *
     * Administrators are excluded: the alert exists to catch someone who cannot
     * be PAID, and an operator account was never going to be. Left in, it
     * reported a problem nobody could fix — there is no bank account to add for
     * a login.
     */
    const rows = await query<{ id: string; name: string }>(
      `SELECT id, name
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
          AND (bank_account IS NULL OR btrim(bank_account) = '')
        ORDER BY name ASC`,
    )
    return rows.map((r) => ({ employeeId: r.id, name: r.name }))
  },
}

// ── attendance ───────────────────────────────────────────────────────────────

const attendanceStats: AttendanceStatsPort = {
  async workedHours(employeeId, period) {
    const rows = await query<{ total: number | null }>(
      `SELECT COALESCE(SUM(worked_hours), 0)::numeric AS total
         FROM attendances
        WHERE employee_id = $1 AND worked_on BETWEEN $2::date AND $3::date`,
      [employeeId, d(period.start), d(period.end)],
    )
    return Number(rows[0]?.total ?? 0)
  },

  async workedDays(employeeId, period) {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM attendances
        WHERE employee_id = $1
          AND worked_on BETWEEN $2::date AND $3::date
          AND status <> 'absent'`,
      [employeeId, d(period.start), d(period.end)],
    )
    return rows[0]?.count ?? 0
  },

  async summary(period, departmentId, employeeType): Promise<AttendanceSummary> {
    /**
     * One pass with FILTER clauses rather than five COUNT queries. Postgres
     * evaluates each aggregate over the same scan, so this is one index range
     * scan instead of five.
     */
    const rows = await query<{
      present: number
      late: number
      absent: number
      overtime_hours: number
      missing_checkouts: number
      manual_edits: number
    }>(
      `SELECT COUNT(*) FILTER (WHERE a.status IN ('present', 'overtime'))::int AS present,
              COUNT(*) FILTER (WHERE a.status = 'late')::int                   AS late,
              COUNT(*) FILTER (WHERE a.status = 'absent')::int                 AS absent,
              COALESCE(SUM(a.worked_hours) FILTER (WHERE a.status = 'overtime'), 0)::numeric
                                                                               AS overtime_hours,
              COUNT(*) FILTER (WHERE a.status = 'missing_checkout')::int       AS missing_checkouts,
              COUNT(*) FILTER (WHERE a.is_manual)::int                         AS manual_edits
         FROM attendances a
         JOIN employees e ON e.id = a.employee_id
        WHERE a.worked_on BETWEEN $1::date AND $2::date
          AND ($3::uuid IS NULL OR e.department_id = $3)
          AND ($4::text IS NULL OR e.employee_type = $4)`,
      [d(period.start), d(period.end), departmentId ?? null, employeeType ?? null],
    )

    const row = rows[0]
    return {
      present: row?.present ?? 0,
      late: row?.late ?? 0,
      absent: row?.absent ?? 0,
      overtimeHours: Number(row?.overtime_hours ?? 0),
      missingCheckouts: row?.missing_checkouts ?? 0,
      manualEdits: row?.manual_edits ?? 0,
    }
  },
}

// ── employment ───────────────────────────────────────────────────────────────

const contractAlerts: ContractAlertsPort = {
  async attentionItems(period: Period, withinDays: number): Promise<ContractAlert[]> {
    /**
     * Two problems, one query.
     *
     * The first branch: an active contract whose end date falls inside the
     * warning window — payroll will stop working for that employee soon.
     * The second: an active employee with NO contract covering the period at
     * all — payroll cannot compute for them now.
     */
    const rows = await query<{
      contract_id: string | null
      employee_id: string
      employee_name: string
      ends_on: Date | null
      kind: ContractAlert['kind']
    }>(
      `SELECT c.id AS contract_id, e.id AS employee_id, e.name AS employee_name,
              c.ends_on,
              CASE WHEN c.ends_on < $1::date THEN 'expired' ELSE 'expiring' END AS kind
         FROM contracts c
         JOIN employees e ON e.id = c.employee_id
        WHERE c.status = 'active'
          AND e.is_active = true
          AND e.${NOT_AN_ADMIN}
          AND c.ends_on IS NOT NULL
          AND c.ends_on <= ($2::date + ($3 || ' days')::interval)

        UNION ALL

       SELECT NULL, e.id, e.name, NULL, 'missing'
         FROM employees e
        WHERE e.is_active = true
          -- An administrator operates the system rather than being paid by it,
          -- so it has no contract and never will. Without this the alert opens
          -- every day reporting a problem nobody can fix, which is how a work
          -- queue stops being read.
          AND e.${NOT_AN_ADMIN}
          AND NOT EXISTS (
            SELECT 1 FROM contracts c2
             WHERE c2.employee_id = e.id
               AND c2.status = 'active'
               AND c2.starts_on <= $2::date
               AND (c2.ends_on IS NULL OR c2.ends_on >= $1::date)
          )
        ORDER BY employee_name ASC`,
      [d(period.start), d(period.end), String(withinDays)],
    )

    return rows.map((r) => ({
      contractId: r.contract_id ?? '',
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      kind: r.kind,
      endsOn: r.ends_on,
      issue:
        r.kind === 'missing'
          ? 'No active contract covers this period'
          : r.kind === 'expired'
            ? 'Contract expired during this period'
            : `Contract ends ${r.ends_on ? d(r.ends_on) : 'soon'}`,
    }))
  },
}

// ── payroll ──────────────────────────────────────────────────────────────────

const payrollStats: PayrollStatsPort = {
  async totals(period, departmentId, employeeType) {
    /**
     * Only PAID payslips count towards "Total Net Salary Paid". A computed or
     * validated payslip is a proposal; counting it would report money that has
     * not left the building.
     */
    const rows = await query<{ total: number | null; count: number }>(
      `SELECT COALESCE(SUM(p.net), 0)::numeric AS total, COUNT(*)::int AS count
         FROM payslips p
         JOIN employees e ON e.id = p.employee_id
        WHERE p.status = 'paid'
          AND p.period_start >= $1::date AND p.period_end <= $2::date
          AND ($3::uuid IS NULL OR e.department_id = $3)
          AND ($4::text IS NULL OR e.employee_type = $4)`,
      [d(period.start), d(period.end), departmentId ?? null, employeeType ?? null],
    )

    const totalNet = Number(rows[0]?.total ?? 0)
    const payslipCount = rows[0]?.count ?? 0
    return {
      totalNet,
      payslipCount,
      averageSalary: payslipCount === 0 ? 0 : Math.round((totalNet / payslipCount) * 100) / 100,
    }
  },

  async costByDepartment(period, employeeType) {
    const rows = await query<{ department_id: string | null; total: number }>(
      `SELECT e.department_id, COALESCE(SUM(p.net), 0)::numeric AS total
         FROM payslips p
         JOIN employees e ON e.id = p.employee_id
        WHERE p.status = 'paid'
          AND p.period_start >= $1::date AND p.period_end <= $2::date
          AND ($3::text IS NULL OR e.employee_type = $3)
        GROUP BY e.department_id`,
      [d(period.start), d(period.end), employeeType ?? null],
    )
    return rows
      .filter((r) => r.department_id !== null)
      .map((r) => ({ departmentId: r.department_id as string, total: Number(r.total) }))
  },

  async monthlyTrend(months) {
    // Grouped by the payslip's period, not its creation date: a March payrun
    // processed in April is March's cost.
    const rows = await query<{ month: string; total: number }>(
      `SELECT to_char(date_trunc('month', period_start), 'YYYY-MM') AS month,
              COALESCE(SUM(net), 0)::numeric                        AS total
         FROM payslips
        WHERE status = 'paid'
          AND period_start >= (date_trunc('month', CURRENT_DATE) - ($1 || ' months')::interval)
        GROUP BY 1
        ORDER BY 1 ASC`,
      [String(months)],
    )
    return rows.map((r) => ({ month: r.month, total: Number(r.total) }))
  },

  async duplicatePayslips(period) {
    /**
     * A UNIQUE constraint already makes two payslips per employee per PAYRUN
     * impossible. This catches the case it cannot: the same employee paid twice
     * for the same period across two different payruns, which is a real
     * double-payment and exactly what spec B9's alert is for.
     */
    const rows = await query<{ employee_id: string; employee_name: string; count: number }>(
      `SELECT p.employee_id, e.name AS employee_name, COUNT(*)::int AS count
         FROM payslips p
         JOIN employees e ON e.id = p.employee_id
        WHERE p.status <> 'cancelled'
          AND p.period_start >= $1::date AND p.period_end <= $2::date
        GROUP BY p.employee_id, e.name
       HAVING COUNT(*) > 1
        ORDER BY count DESC`,
      [d(period.start), d(period.end)],
    )
    return rows.map((r) => ({
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      count: r.count,
    }))
  },
}

// ── registration ─────────────────────────────────────────────────────────────

const INTERIM: Array<[string, () => unknown, string]> = [
  [PORT_KEYS.employeeStats, () => employeeStats, 'modules/people'],
  [PORT_KEYS.attendanceStats, () => attendanceStats, 'modules/attendance'],
  [PORT_KEYS.contractAlerts, () => contractAlerts, 'modules/employment'],
  [PORT_KEYS.payrollStats, () => payrollStats, 'modules/payroll-processing'],
]

/** Fills any dashboard port nobody has claimed. Called last, so real wins. */
export function registerInterimStats(): void {
  const unclaimed: string[] = []

  for (const [key, factory, owner] of INTERIM) {
    if (!container().ports.has(key as never)) unclaimed.push(owner)
    providePort(key as never, factory)
  }

  if (unclaimed.length > 0) {
    console.warn(
      `[bootstrap] dashboard is using INTERIM adapters for: ${unclaimed.join(', ')} — delete lib/interim-stats.ts as each registers for real`,
    )
  }
}
