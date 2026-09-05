/**
 * Public surface of the "timeoff" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: Dev A — see docs/plans/DEV-A-platform.md.
 *
 * SERVER ONLY. This barrel reaches the Postgres repositories, which import the
 * `pg` driver. Client components import `@/modules/timeoff/schemas` instead —
 * same zod definitions, no database.
 */
export {
  listLeaveRequests,
  getLeaveRequest,
  requestLeave,
  submitLeave,
  approveLeave,
  refuseLeave,
  deleteLeave,
  listAllocations,
  allocate,
  decideAllocation,
  getBalance,
  listEmployeeOptions,
  listTimeOffTypes,
  createTimeOffType,
  updateTimeOffType,
  deleteTimeOffType,
} from './interface/timeoff.controller'

export type { EmployeeOption } from './interface/timeoff.controller'
export type { LeaveRequestListItem } from './application/list-leave-requests.use-case'
export type { AllocationListItem } from './application/list-allocations.use-case'
export type { LeaveRequestDetail } from './application/get-leave-request.use-case'
export type { TimeOffTypeView } from './domain/time-off-type'
export { ALLOCATION_STATUSES } from './domain/allocation'
export type { AllocationView, AllocationStatus } from './domain/allocation'
export type { LeaveRequestView } from './domain/leave-request'

/**
 * Registration. Called once per process from `lib/bootstrap.ts`.
 *
 * This is how `analytics` gets leave figures without importing this module:
 * we publish an implementation of the shared `LeaveStatsPort` under a well-known
 * key, and the dashboard resolves it by key. Before this runs, the dashboard
 * degrades to zeros rather than crashing.
 */
export { registerTimeOff } from './register'
