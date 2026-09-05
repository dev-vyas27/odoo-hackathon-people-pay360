/**
 * Grant an allocation, and decide on one.
 *
 * Spec A4: "Allocations manage employee balances, **requiring approval before
 * availability**". So a new allocation starts in `to_approve` and is not
 * spendable — `Allocation.isUsable` is false until someone approves it, and
 * `eligibleAllocations` filters on exactly that. Creating an entitlement and
 * granting it are two acts by two people.
 */
import {
  DomainError,
  Err,
  Ok,
  Period,
  authorize,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { Allocation, type AllocationView } from '../domain/allocation'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'
import type { EmployeeLookupPort } from './ports/employee-lookup.port'

export interface AllocateInput {
  actor: Actor
  employeeId: string
  timeOffTypeId: string
  allocated: number
  validFrom: Date
  validTo: Date
  note?: string | null
  /** Skips the approval step. Only an approver may ask for it. */
  approveImmediately?: boolean
}

export class AllocateUseCase implements UseCase<AllocateInput, AllocationView> {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly employees: EmployeeLookupPort,
  ) {}

  async execute(input: AllocateInput): Promise<Result<AllocationView>> {
    const allowed = authorize(input.actor, 'allocation', 'create')
    if (!allowed.ok) return allowed

    try {
      const { types, allocations } = this.uow.repos

      const type = await types.findById(input.timeOffTypeId)
      if (!type) {
        return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
      }
      if (!type.isActive) {
        return Err(DomainError.rule('TIME_OFF_TYPE_INACTIVE', `${type.name} is no longer available`))
      }
      /**
       * A type that needs no allocation has no balance to hold. Allocating
       * against unpaid leave would create a number nothing ever reads, which is
       * worse than an error because it looks like it works.
       */
      if (!type.requiresAllocation) {
        return Err(
          DomainError.rule(
            'TIME_OFF_TYPE_NEEDS_NO_ALLOCATION',
            `${type.name} does not use allocations, so there is no balance to grant`,
          ),
        )
      }

      const employee = await this.employees.findById(input.employeeId)
      if (!employee) {
        return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', 'That employee does not exist'))
      }

      // Only someone who could approve it may create it pre-approved.
      const immediate =
        input.approveImmediately === true && authorize(input.actor, 'allocation', 'approve').ok

      const allocation = Allocation.from({
        id: 'new',
        employeeId: input.employeeId,
        timeOffTypeId: type.id,
        // The unit always comes from the type, never from the request body:
        // an allocation in hours against a day-based type is meaningless.
        unit: type.unit,
        allocated: input.allocated,
        taken: 0,
        validity: Period.of(input.validFrom, input.validTo),
        status: immediate ? 'approved' : 'to_approve',
        note: input.note ?? null,
      })

      const props = allocation.toProps()
      const saved = await allocations.create({
        employeeId: props.employeeId,
        timeOffTypeId: props.timeOffTypeId,
        unit: props.unit,
        allocated: props.allocated,
        taken: props.taken,
        validity: props.validity,
        status: props.status,
        note: props.note,
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}

export interface DecideAllocationInput {
  actor: Actor
  allocationId: string
  decision: 'approve' | 'refuse'
}

/**
 * The approval step that makes an allocation spendable — or refuses it.
 *
 * `Allocation.refuse()` throws when anything has already been taken against it,
 * because withdrawing a balance somebody has already spent would leave approved
 * leave funded by nothing.
 */
export class DecideAllocationUseCase implements UseCase<DecideAllocationInput, AllocationView> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: DecideAllocationInput): Promise<Result<AllocationView>> {
    const allowed = authorize(input.actor, 'allocation', 'approve')
    if (!allowed.ok) return allowed

    try {
      const saved = await this.uow.transaction(async (repos) => {
        const allocation = await repos.allocations.findByIdForUpdate(input.allocationId)
        if (!allocation) {
          throw DomainError.notFound('ALLOCATION_NOT_FOUND', 'That allocation does not exist')
        }

        if (input.decision === 'approve') allocation.approve()
        else allocation.refuse()

        return repos.allocations.save(allocation)
      })

      return Ok(saved.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}
