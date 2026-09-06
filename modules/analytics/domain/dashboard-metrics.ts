


import { Period, type AttendanceSummary, type SeriesPoint } from '@/modules/shared'



export function attendanceHealth(summary: AttendanceSummary): number | null {
  const exceptions = summary.late + summary.absent + summary.missingCheckouts
  const total = summary.present + exceptions

  if (total === 0) return null
  return round1((summary.present / total) * 100)
}



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
  
  
  return round1(Math.min(100, (recorded / expected) * 100))
}


function clampEnd(period: Period, asOf: Date): Period | null {
  if (asOf.getTime() < period.start.getTime()) return null
  return Period.of(period.start, asOf)
}


export function businessDays(period: Period): number {
  return period.eachDay().filter((day) => {
    const weekday = day.getUTCDay()
    return weekday !== 0 && weekday !== 6
  }).length
}



export function averageSalary(totalNet: number, payslipCount: number): number {
  if (payslipCount === 0) return 0
  return Math.round((totalNet / payslipCount) * 100) / 100
}



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
