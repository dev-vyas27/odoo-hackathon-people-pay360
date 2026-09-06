/**
 * Fakes for the two ports leave duration now depends on.
 *
 * Duration is no longer the calendar span, so a use-case test has to say what
 * pattern the employee works. These keep that a one-liner rather than a block
 * of port stubs at the top of every test.
 */
import { Period, type EmployeeLookupPort, type EmployeeSummary, type ScheduleQueryPort } from '@/modules/shared'

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Mon-Fri. The pattern almost every employee in the seed actually works. */
export const MON_TO_FRI: Weekday[] = [1, 2, 3, 4, 5]
/** Mon-Thu, the compressed week — proves the rule is not "skip the weekend". */
export const MON_TO_THU: Weekday[] = [1, 2, 3, 4]

const SCHEDULE_ID = 'schedule-1'

export function fakeEmployees(scheduleId: string | null = SCHEDULE_ID): EmployeeLookupPort {
  const summary = (id: string): EmployeeSummary => ({
    id,
    name: `Employee ${id}`,
    email: `${id}@co.com`,
    departmentId: null,
    departmentName: null,
    jobPositionName: null,
    employeeType: 'full_time',
    managerId: null,
    workingScheduleId: scheduleId,
    bankAccount: null,
    isActive: true,
  })
  return {
    async findById(id) {
      return summary(id)
    },
    async findManyByIds(ids) {
      return ids.map(summary)
    },
    async findEligible() {
      return []
    },
  }
}

export function fakeSchedules(days: Weekday[] = MON_TO_FRI): ScheduleQueryPort {
  const worked = new Set(days)
  return {
    async findById(id) {
      return {
        id,
        name: 'Fake schedule',
        weeklyHours: worked.size * 8,
        days: days.map((day) => ({ day, start: '09:00', end: '18:00', breakMinutes: 60 })),
      }
    },
    async expectedHours(_id, period) {
      return countWorked(period, worked) * 8
    },
    async expectedDays(_id, period) {
      return countWorked(period, worked)
    },
  }
}

function countWorked(period: Period, worked: Set<Weekday>): number {
  return period.eachDay().filter((date) => worked.has(date.getUTCDay() as Weekday)).length
}
