/**
 * Dashboard maths. Pure functions, no I/O, no clock.
 *
 * Two of the figures the spec names — "Attendance Health" and "attendance
 * coverage" — are not stored anywhere; they are derived. Deriving them in a
 * pure function rather than inline in a SQL string means the definition is
 * stated once, is unit-tested, and can be read by anyone asking "what does that
 * percentage actually mean?" — which is the first question a judge will ask
 * about a number they have never seen before.
 */
import { Period, type AttendanceSummary, type SeriesPoint } from '@/modules/shared'

/**
 * Attendance Health: the share of attendance records that carry no exception.
 *
 * `present` and overtime days are healthy; late, absent and a missing check-out
 * are not. Expressed 0-100 and rounded to one decimal, because a dashboard tile
 * showing 94.7368421% is not a dashboard tile.
 *
 * Returns null rather than 0 when there are no records at all. Zero would read
 * as "everybody was absent", which is the opposite of "we have no data yet" —
 * and on an empty demo database those are very different claims.
 */
export function attendanceHealth(summary: AttendanceSummary): number | null {
  const exceptions = summary.late + summary.absent + summary.missingCheckouts
  const total = summary.present + exceptions

  if (total === 0) return null
  return round1((summary.present / total) * 100)
}

/**
 * Attendance coverage: recorded days against days we expected a record.
 *
 * The denominator is headcount x business days ELAPSED. Counting the whole
 * period would mean that on the 5th of a month the figure reads ~18%, because
 * it is measuring against twenty-two days that have not happened yet. Clamping
 * the window at `asOf` is what makes this answer "are people filing their
 * attendance?" rather than "how far through the month are we?".
 *
 * The denominator is still an APPROXIMATION — the exact figure needs each
 * employee's working schedule, which is `ScheduleQueryPort.expectedHours` and
 * is Dev B's to provide. Monday-to-Friday is the honest stand-in until then,
 * and the screen labels it as approximate rather than presenting it as precise.
 */
export function attendanceCoverage(
  summary: AttendanceSummary,
  headcount: number,
  period: Period,
  asOf: Date,
): number | null {
  const elapsed = period.end.getTime() <= asOf.getTime() ? period : clampEnd(period, asOf)
  if (elapsed === null) return null

  const expected = headcount * businessDays(elapsed)
  if (expected === 0) return null

  const recorded = summary.present + summary.late + summary.absent + summary.missingCheckouts
  // Clamped: a manual back-fill can legitimately push recorded past expected,
  // and "112% coverage" looks like a bug even when it is not.
  return round1(Math.min(100, (recorded / expected) * 100))
}

/** The period truncated at `asOf`, or null when it has not started yet. */
function clampEnd(period: Period, asOf: Date): Period | null {
  if (asOf.getTime() < period.start.getTime()) return null
  return Period.of(period.start, asOf)
}

/** Monday to Friday inside the period. */
export function businessDays(period: Period): number {
  return period.eachDay().filter((day) => {
    const weekday = day.getUTCDay()
    return weekday !== 0 && weekday !== 6
  }).length
}

/**
 * Average net salary. Not `totalNet / headcount` — `totalNet / payslipCount`.
 *
 * An employee who joined mid-period has no payslip, and including them in the
 * denominator drags the average down for a reason that has nothing to do with
 * salaries. The spec asks for "Average Salary" next to "Payslips Generated";
 * these two agreeing is what makes the pair readable.
 */
export function averageSalary(totalNet: number, payslipCount: number): number {
  if (payslipCount === 0) return 0
  return Math.round((totalNet / payslipCount) * 100) / 100
}

/**
 * Turn department totals into chart points, largest first, resolving ids to
 * names. Departments with no spend are dropped: a bar of height zero carries no
 * information and squashes the scale of the ones that do.
 */
export function toDepartmentSeries(
  totals: Array<{ departmentId: string; total: number }>,
  names: Map<string, string>,
): SeriesPoint[] {
  return totals
    .filter((row) => row.total > 0)
    .map((row) => ({
      label: names.get(row.departmentId) ?? 'Unassigned',
      value: round2(row.total),
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Fill gaps in the monthly trend.
 *
 * A payroll month with no payrun returns no row, and a line chart that skips
 * from March to May draws a straight line through April as though something
 * was paid. Explicit zeros make the gap visible, which is the truthful shape.
 */
export function fillMonthlyTrend(
  points: Array<{ month: string; total: number }>,
  months: number,
  endingAt: Date,
): SeriesPoint[] {
  const byMonth = new Map(points.map((p) => [p.month, p.total]))
  const out: SeriesPoint[] = []

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(endingAt.getUTCFullYear(), endingAt.getUTCMonth() - offset, 1),
    )
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    out.push({
      label: MONTH_LABELS[date.getUTCMonth()],
      value: round2(byMonth.get(key) ?? 0),
    })
  }

  return out
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Resolve the `?period=` filter to a Period.
 *
 * Accepts `YYYY-MM` for a month and `YYYY` for a year; anything else falls back
 * to the month containing `today`. Parsing leniently and defaulting rather than
 * erroring is deliberate: a malformed URL should show the dashboard, not a 400.
 */
export function resolvePeriod(value: string | undefined, today: Date): Period {
  const month = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (month) return Period.month(Number(month[1]), Number(month[2]))

  const year = /^(\d{4})$/.exec(value ?? '')
  if (year) {
    return Period.of(
      new Date(Date.UTC(Number(year[1]), 0, 1)),
      new Date(Date.UTC(Number(year[1]), 11, 31)),
    )
  }

  return Period.month(today.getUTCFullYear(), today.getUTCMonth() + 1)
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100
