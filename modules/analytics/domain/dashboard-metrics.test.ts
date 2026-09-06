


import { describe, expect, it } from 'vitest'
import { Period, type AttendanceSummary } from '@/modules/shared'
import {
  attendanceCoverage,
  attendanceHealth,
  averageSalary,
  businessDays,
  fillMonthlyTrend,
  resolvePeriod,
  toDepartmentSeries,
} from './dashboard-metrics'

const summary = (over: Partial<AttendanceSummary> = {}): AttendanceSummary => ({
  present: 0,
  late: 0,
  absent: 0,
  overtimeHours: 0,
  missingCheckouts: 0,
  manualEdits: 0,
  ...over,
})

describe('attendanceHealth', () => {
  it('is the share of records with no exception', () => {
    
    expect(attendanceHealth(summary({ present: 18, late: 1, absent: 1 }))).toBe(90)
  })

  it('counts a missing check-out as an exception', () => {
    expect(attendanceHealth(summary({ present: 9, missingCheckouts: 1 }))).toBe(90)
  })

  it('is 100 when nothing went wrong', () => {
    expect(attendanceHealth(summary({ present: 20 }))).toBe(100)
  })

  it('returns null on no data rather than 0', () => {
    
    expect(attendanceHealth(summary())).toBeNull()
  })

  it('rounds to one decimal', () => {
    expect(attendanceHealth(summary({ present: 2, late: 1 }))).toBe(66.7)
  })
})

describe('businessDays', () => {
  it('counts Monday to Friday only', () => {
    
    expect(businessDays(Period.month(2026, 3))).toBe(22)
  })

  it('handles a period that is a single weekend day', () => {
    const saturday = new Date(Date.UTC(2026, 2, 7))
    expect(businessDays(Period.of(saturday, saturday))).toBe(0)
  })
})

describe('attendanceCoverage', () => {
  const monthEnd = new Date(Date.UTC(2026, 2, 31))

  it('measures recorded days against headcount times business days', () => {
    
    const coverage = attendanceCoverage(summary({ present: 22 }), 2, Period.month(2026, 3), monthEnd)
    expect(coverage).toBe(50)
  })

  it('counts only business days ELAPSED, not the whole month', () => {
    


    const fourthOfMarch = new Date(Date.UTC(2026, 2, 4))
    const coverage = attendanceCoverage(summary({ present: 3 }), 1, Period.month(2026, 3), fourthOfMarch)
    expect(coverage).toBe(100)
  })

  it('clamps at 100 so a back-fill does not read as a bug', () => {
    const coverage = attendanceCoverage(summary({ present: 100 }), 1, Period.month(2026, 3), monthEnd)
    expect(coverage).toBe(100)
  })

  it('returns null for a period that has not started', () => {
    const lastYear = new Date(Date.UTC(2025, 0, 1))
    expect(attendanceCoverage(summary({ present: 5 }), 1, Period.month(2026, 3), lastYear)).toBeNull()
  })

  it('returns null when there is nobody to cover', () => {
    expect(attendanceCoverage(summary({ present: 5 }), 0, Period.month(2026, 3), monthEnd)).toBeNull()
  })
})

describe('averageSalary', () => {
  it('divides by payslips issued, not by headcount', () => {
    expect(averageSalary(300_000, 4)).toBe(75_000)
  })

  it('is zero when nothing was paid', () => {
    expect(averageSalary(0, 0)).toBe(0)
  })
})

describe('toDepartmentSeries', () => {
  const names = new Map([
    ['d1', 'Engineering'],
    ['d2', 'Sales'],
  ])

  it('resolves names and sorts by spend descending', () => {
    const series = toDepartmentSeries(
      [
        { departmentId: 'd2', total: 50 },
        { departmentId: 'd1', total: 120 },
      ],
      names,
    )
    expect(series.map((p) => p.label)).toEqual(['Engineering', 'Sales'])
  })

  it('drops zero-spend departments so they do not flatten the scale', () => {
    const series = toDepartmentSeries(
      [
        { departmentId: 'd1', total: 120 },
        { departmentId: 'd2', total: 0 },
      ],
      names,
    )
    expect(series).toHaveLength(1)
  })

  it('labels an unknown department rather than dropping the spend', () => {
    const series = toDepartmentSeries([{ departmentId: 'ghost', total: 10 }], names)
    expect(series[0].label).toBe('Unassigned')
  })
})

describe('fillMonthlyTrend', () => {
  it('emits one point per month, oldest first', () => {
    const trend = fillMonthlyTrend([], 6, new Date(Date.UTC(2026, 5, 15)))
    expect(trend.map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'])
  })

  it('fills a month with no payrun with an explicit zero', () => {
    
    
    const trend = fillMonthlyTrend(
      [
        { month: '2026-04', total: 100 },
        { month: '2026-06', total: 300 },
      ],
      3,
      new Date(Date.UTC(2026, 5, 1)),
    )
    expect(trend).toEqual([
      { label: 'Apr', value: 100 },
      { label: 'May', value: 0 },
      { label: 'Jun', value: 300 },
    ])
  })

  it('crosses a year boundary correctly', () => {
    const trend = fillMonthlyTrend([], 3, new Date(Date.UTC(2026, 0, 10)))
    expect(trend.map((p) => p.label)).toEqual(['Nov', 'Dec', 'Jan'])
  })
})

describe('resolvePeriod', () => {
  const today = new Date(Date.UTC(2026, 2, 15))

  it('reads YYYY-MM as that calendar month', () => {
    expect(resolvePeriod('2026-03', today).toString()).toBe('2026-03-01..2026-03-31')
  })

  it('reads YYYY as the whole year', () => {
    expect(resolvePeriod('2025', today).toString()).toBe('2025-01-01..2025-12-31')
  })

  it('falls back to the current month rather than erroring on rubbish', () => {
    
    expect(resolvePeriod('not-a-period', today).toString()).toBe('2026-03-01..2026-03-31')
    expect(resolvePeriod(undefined, today).toString()).toBe('2026-03-01..2026-03-31')
  })
})
