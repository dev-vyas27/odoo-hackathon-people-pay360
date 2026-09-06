/**
 * The employee's working pattern, consumed from Dev B's `employment` module.
 *
 * Time Off needs exactly one thing from a schedule: how many days inside a
 * requested period the employee was actually rostered to work. Billing the
 * calendar span instead charges them for weekends — and for the Friday of a
 * compressed Mon-Thu week, which is why this asks the schedule rather than
 * hardcoding "skip Saturday and Sunday".
 *
 * As with `employee-lookup.port.ts`, the interface lives in the shared
 * contracts file and what lives HERE is the null object used when `employment`
 * has not registered its adapter.
 */
import { PORT_KEYS, portOr, type ScheduleQueryPort } from '@/modules/shared'

export type { ScheduleQueryPort }

/**
 * `findById` returning null is the "I cannot answer" signal callers check
 * before trusting `expectedDays`. Without that guard an unregistered port would
 * answer "0 working days" and reject every leave request as falling entirely on
 * days off — a far worse failure than falling back to the calendar span.
 */
export const UNRESOLVED_SCHEDULE_QUERY: ScheduleQueryPort = {
  async findById() {
    return null
  },
  async expectedHours() {
    return 0
  },
  async expectedDays() {
    return 0
  },
}

export function scheduleLookup(): ScheduleQueryPort {
  return portOr(PORT_KEYS.scheduleQuery, UNRESOLVED_SCHEDULE_QUERY)
}
