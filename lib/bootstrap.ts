/**
 * Composition, once per process.
 *
 * Each module publishes its cross-module ports from its own `register()`; this
 * file is the only place that knows all of them exist. That is what lets
 * `analytics` consume leave figures without importing `timeoff`, and it is what
 * keeps integration to a two-line diff instead of a merge conflict.
 *
 * `providePort` is FIRST-WINS and the interim adapters are registered LAST, so
 * a real implementation always beats the scaffolding.
 *
 * Called from `instrumentation.ts`, which Next runs once at server startup.
 */
import { registerTimeOff } from '@/modules/timeoff'
import { registerPeople } from '@/modules/people'
import { registerEmployment } from '@/modules/employment'
import { registerAttendance } from '@/modules/attendance'
import { registerInterimAdapters } from '@/lib/interim-adapters'

let done = false

export function bootstrap(): void {
  // Next re-evaluates modules on hot reload; registering twice would re-subscribe
  // every event handler and fire each one N times.
  if (done) return
  done = true

  // ── Dev A ────────────────────────────────────────────────────────────────
  registerTimeOff()

  // ── Dev B ──────────────────────────────────────────────────────────────
  registerPeople()          // EmployeeLookupPort
  registerEmployment()      // ContractQueryPort, ScheduleQueryPort
  registerAttendance()      // AttendanceStatsPort

  // ── Dev C ────────────────────────────────────────────────────────────────
  // import { registerPayrollProcessing } from '@/modules/payroll-processing'
  // registerPayrollProcessing()   // PayslipQueryPort, PayrollStatsPort

  // Must stay last: fills only the ports nobody claimed above.
  registerInterimAdapters()
}
