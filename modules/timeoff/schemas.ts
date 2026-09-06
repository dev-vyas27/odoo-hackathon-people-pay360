/**
 * Client-safe surface of `timeoff`.
 *
 * `@/modules/timeoff` (index.ts) reaches the Postgres repositories, so importing
 * that barrel from a `'use client'` file drags the `pg` driver into the browser
 * bundle and the page dies at module evaluation.
 *
 * The schemas are the thing both sides genuinely share: the form validates with
 * them, the route handler validates with them, and they depend on nothing but
 * zod. Types are re-exported too, so a table component can be typed against the
 * same shape the API returns without importing the server barrel.
 */
export {
  timeOffTypeSchema,
  allocationSchema,
  allocationDecisionSchema,
  leaveRequestSchema,
  balanceQuerySchema,
  type TimeOffTypeValues,
  type AllocationValues,
  type LeaveRequestValues,
} from './interface/timeoff.schema'

export type { EmployeeOption } from './interface/timeoff.controller'
export type { LeaveRequestListItem } from './application/list-leave-requests.use-case'
export type { AllocationListItem } from './application/list-allocations.use-case'
export type { LeaveRequestDetail } from './application/get-leave-request.use-case'
export type { TimeOffTypeView } from './domain/time-off-type'
export { ALLOCATION_STATUSES } from './domain/allocation'
export type { AllocationView, AllocationStatus } from './domain/allocation'
export type { LeaveRequestView } from './domain/leave-request'
