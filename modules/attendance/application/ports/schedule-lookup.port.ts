/**
 * ScheduleLookupPort — the NARROW slice of employment/schedule data that
 * exception derivation needs, and nothing else.
 *
 * We deliberately do not depend on employment's full `ScheduleQueryPort` /
 * `EmployeeLookupPort` shapes (see docs/plans/DEV-B-hr-operations.md) — those
 * are owned by another module being built in parallel. Instead we ask for
 * exactly one thing: "what was this employee expected to do on this day?".
 * The infrastructure adapter is responsible for bridging that from whatever
 * the employment/people modules end up publishing.
 */
import type { DailySchedule } from '../../domain/exception'

export interface ScheduleLookupPort {
  /** Null when the employee has no assigned schedule, or none is known yet. */
  scheduleForDay(employeeId: string, date: Date): Promise<DailySchedule | null>
}
