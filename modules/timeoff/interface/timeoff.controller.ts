/**
 * Time Off's controller: parse, delegate, return a Result.
 *
 * It never touches cookies or Response — that is the route handler's job. Which
 * is what keeps every route file down to the promised five lines, and keeps
 * these functions callable from a test or a script.
 */
import {
  DomainError,
  Err,
  Ok,
  authorize,
  resolve,
  scopeToSelf,
  type Actor,
  type LeaveBalanceView,
  type PageQuery,
  type Paged,
  type Result,
} from '@/modules/shared'
import { RequestLeaveUseCase } from '../application/request-leave.use-case'
import { ApproveLeaveUseCase } from '../application/approve-leave.use-case'
import { RefuseLeaveUseCase } from '../application/refuse-leave.use-case'
import { DeleteLeaveUseCase, SubmitLeaveUseCase } from '../application/submit-leave.use-case'
import { GetLeaveRequestUseCase, type LeaveRequestDetail } from '../application/get-leave-request.use-case'
import {
  ListLeaveRequestsUseCase,
  type LeaveRequestListItem,
} from '../application/list-leave-requests.use-case'
import { AllocateUseCase, DecideAllocationUseCase } from '../application/allocate.use-case'
import {
  ListAllocationsUseCase,
  type AllocationListItem,
} from '../application/list-allocations.use-case'
import { GetBalanceUseCase } from '../application/get-balance.use-case'
import {
  CreateTimeOffTypeUseCase,
  DeleteTimeOffTypeUseCase,
  ListTimeOffTypesUseCase,
  UpdateTimeOffTypeUseCase,
} from '../application/manage-time-off-types.use-case'
import type { AllocationView } from '../domain/allocation'
import type { LeaveRequestView } from '../domain/leave-request'
import type { TimeOffTypeView } from '../domain/time-off-type'
import { PostgresUnitOfWork } from '../infrastructure/postgres-unit-of-work'
import { employeeLookup } from '../application/ports/employee-lookup.port'
import { container } from '@/modules/shared'
import {
  allocationDecisionSchema,
  allocationSchema,
  balanceQuerySchema,
  leaveRequestSchema,
  timeOffTypeSchema,
} from './timeoff.schema'

/**
 * Wiring, cached per process by `resolve`. Swapping in a fake unit of work for
 * a test is a matter of seeding the container, not of editing this file.
 */
const deps = () => ({
  uow: resolve('timeoff.uow', () => new PostgresUnitOfWork()),
  // Resolved per call, not cached: before Dev B registers the real adapter this
  // returns the null object, and it must start returning real names the moment
  // they do — without a restart.
  employees: employeeLookup(),
  events: container().eventBus,
})

/** Turn a zod failure into the same DomainError shape every other failure uses. */
function invalid(issues: { path: PropertyKey[]; message: string }[]): DomainError {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_'
    fieldErrors[key] ??= issue.message
  }
  return DomainError.validation('VALIDATION_FAILED', 'Check the highlighted fields', fieldErrors)
}

// ── leave requests ───────────────────────────────────────────────────────────

export function listLeaveRequests(
  actor: Actor,
  query: PageQuery,
): Promise<Result<Paged<LeaveRequestListItem>>> {
  const { uow, employees } = deps()
  return new ListLeaveRequestsUseCase(uow, employees).execute({ actor, query })
}

export function getLeaveRequest(
  actor: Actor,
  requestId: string,
): Promise<Result<LeaveRequestDetail>> {
  const { uow, employees } = deps()
  return new GetLeaveRequestUseCase(uow, employees).execute({ actor, requestId })
}

export async function requestLeave(
  actor: Actor,
  body: unknown,
): Promise<Result<LeaveRequestView>> {
  const parsed = leaveRequestSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { uow, events } = deps()

  return new RequestLeaveUseCase(uow, events).execute({
    actor,
    employeeId: parsed.data.employeeId,
    timeOffTypeId: parsed.data.timeOffTypeId,
    start: parsed.data.start,
    end: parsed.data.end,
    duration: parsed.data.duration,
    reason: parsed.data.reason || null,
    asDraft: parsed.data.asDraft,
  })
}

export function submitLeave(actor: Actor, requestId: string): Promise<Result<LeaveRequestView>> {
  const { uow, events } = deps()
  return new SubmitLeaveUseCase(uow, events).execute({ actor, requestId })
}

export function approveLeave(actor: Actor, requestId: string): Promise<Result<LeaveRequestView>> {
  const { uow, events } = deps()
  return new ApproveLeaveUseCase(uow, events).execute({ actor, requestId })
}

export function refuseLeave(actor: Actor, requestId: string): Promise<Result<LeaveRequestView>> {
  const { uow, events } = deps()
  return new RefuseLeaveUseCase(uow, events).execute({ actor, requestId })
}

export function deleteLeave(actor: Actor, requestId: string): Promise<Result<true>> {
  return new DeleteLeaveUseCase(deps().uow).execute({ actor, requestId })
}

// ── allocations ──────────────────────────────────────────────────────────────

export function listAllocations(
  actor: Actor,
  query: PageQuery,
): Promise<Result<Paged<AllocationListItem>>> {
  const { uow, employees } = deps()
  return new ListAllocationsUseCase(uow, employees).execute({ actor, query })
}

export async function allocate(actor: Actor, body: unknown): Promise<Result<AllocationView>> {
  const parsed = allocationSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  const { uow, employees } = deps()
  return new AllocateUseCase(uow, employees).execute({
    actor,
    employeeId: parsed.data.employeeId,
    timeOffTypeId: parsed.data.timeOffTypeId,
    allocated: parsed.data.allocated,
    validFrom: parsed.data.validFrom,
    validTo: parsed.data.validTo,
    note: parsed.data.note || null,
  })
}

export async function decideAllocation(
  actor: Actor,
  allocationId: string,
  decision: 'approve' | 'refuse',
): Promise<Result<AllocationView>> {
  const parsed = allocationDecisionSchema.safeParse({ decision })
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  return new DecideAllocationUseCase(deps().uow).execute({
    actor,
    allocationId,
    decision: parsed.data.decision,
  })
}

// ── balances ─────────────────────────────────────────────────────────────────

export async function getBalance(
  actor: Actor,
  params: Record<string, string>,
): Promise<Result<LeaveBalanceView[]>> {
  const parsed = balanceQuerySchema.safeParse({
    // Defaults to the caller's own employee record, which is what an employee
    // opening their balance page wants and all they are allowed to see.
    employeeId: params.employeeId || actor.employeeId || '',
    on: params.on || undefined,
  })
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  return new GetBalanceUseCase(deps().uow).execute({
    actor,
    employeeId: parsed.data.employeeId,
    on: parsed.data.on,
  })
}

// ── employee picker ──────────────────────────────────────────────────────────

export interface EmployeeOption {
  id: string
  name: string
}

/**
 * The employee dropdown on the request and allocation forms.
 *
 * Sourced through `EmployeeLookupPort`, so Time Off still knows nothing about
 * Dev B's tables. A self-scoped role gets exactly one option — their own record
 * — which is both the only thing they may pick and the only thing they need.
 */
export async function listEmployeeOptions(actor: Actor): Promise<Result<EmployeeOption[]>> {
  const allowed = authorize(actor, 'leave_request', 'read')
  if (!allowed.ok) return allowed

  const { employees } = deps()

  if (scopeToSelf(actor.role)) {
    if (!actor.employeeId) return Ok([])
    const self = await employees.findById(actor.employeeId)
    return Ok(self ? [{ id: self.id, name: self.name }] : [])
  }

  const all = await employees.findEligible({ activeOn: new Date() })
  return Ok(all.map((employee) => ({ id: employee.id, name: employee.name })))
}

// ── time off types ───────────────────────────────────────────────────────────

export function listTimeOffTypes(
  actor: Actor,
  query: PageQuery,
): Promise<Result<Paged<TimeOffTypeView>>> {
  return new ListTimeOffTypesUseCase(deps().uow).execute({ actor, query })
}

export async function createTimeOffType(
  actor: Actor,
  body: unknown,
): Promise<Result<TimeOffTypeView>> {
  const parsed = timeOffTypeSchema.safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  return new CreateTimeOffTypeUseCase(deps().uow).execute({ actor, values: parsed.data })
}

export async function updateTimeOffType(
  actor: Actor,
  id: string,
  body: unknown,
): Promise<Result<TimeOffTypeView>> {
  // `.partial()` on the same schema: a PATCH validates every field it carries
  // by exactly the rules a POST would apply, and ignores the ones it does not.
  const parsed = timeOffTypeSchema.partial().safeParse(body)
  if (!parsed.success) return Err(invalid(parsed.error.issues))

  return new UpdateTimeOffTypeUseCase(deps().uow).execute({ actor, id, values: parsed.data })
}

export function deleteTimeOffType(actor: Actor, id: string): Promise<Result<true>> {
  return new DeleteTimeOffTypeUseCase(deps().uow).execute({ actor, id })
}
