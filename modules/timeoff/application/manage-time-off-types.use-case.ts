


import {
  DomainError,
  Err,
  Ok,
  authorize,
  paged,
  type Actor,
  type LeaveUnit,
  type PageQuery,
  type Paged,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { TimeOffTypeView } from '../domain/time-off-type'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface TimeOffTypeInput {
  name: string
  code: string
  unit: LeaveUnit
  requiresAllocation: boolean
  
  autoApprove: boolean
  isPaid: boolean
  isActive: boolean
}

export class ListTimeOffTypesUseCase
  implements UseCase<{ actor: Actor; query: PageQuery }, Paged<TimeOffTypeView>>
{
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: { actor: Actor; query: PageQuery }): Promise<Result<Paged<TimeOffTypeView>>> {
    const allowed = authorize(input.actor, 'time_off_type', 'read')
    if (!allowed.ok) return allowed

    const page = await this.uow.repos.types.findMany(input.query)
    return Ok(paged(page.items.map((t) => t.toView()), page.total, page.page, page.limit))
  }
}

export class CreateTimeOffTypeUseCase
  implements UseCase<{ actor: Actor; values: TimeOffTypeInput }, TimeOffTypeView>
{
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: {
    actor: Actor
    values: TimeOffTypeInput
  }): Promise<Result<TimeOffTypeView>> {
    const allowed = authorize(input.actor, 'time_off_type', 'create')
    if (!allowed.ok) return allowed

    try {
      
      
      const created = await this.uow.repos.types.create(input.values)
      return Ok(created.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}

export class UpdateTimeOffTypeUseCase
  implements UseCase<{ actor: Actor; id: string; values: Partial<TimeOffTypeInput> }, TimeOffTypeView>
{
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: {
    actor: Actor
    id: string
    values: Partial<TimeOffTypeInput>
  }): Promise<Result<TimeOffTypeView>> {
    const allowed = authorize(input.actor, 'time_off_type', 'update')
    if (!allowed.ok) return allowed

    try {
      const existing = await this.uow.repos.types.findById(input.id)
      if (!existing) {
        return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
      }

      


      if (input.values.unit && input.values.unit !== existing.unit) {
        const [inUse] = await Promise.all([
          this.uow.repos.allocations.findMany({
            limit: 1,
            filters: { timeOffTypeId: input.id },
          }),
        ])
        if (inUse.total > 0) {
          return Err(
            DomainError.rule(
              'TIME_OFF_UNIT_LOCKED',
              'This type already has allocations, so its unit can no longer change',
            ),
          )
        }
      }

      const updated = await this.uow.repos.types.update(input.id, input.values)
      if (!updated) {
        return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
      }
      return Ok(updated.toView())
    } catch (reason) {
      if (DomainError.is(reason)) return Err(reason)
      throw reason
    }
  }
}

export class DeleteTimeOffTypeUseCase implements UseCase<{ actor: Actor; id: string }, true> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: { actor: Actor; id: string }): Promise<Result<true>> {
    const allowed = authorize(input.actor, 'time_off_type', 'delete')
    if (!allowed.ok) return allowed

    


    const [allocations, requests] = await Promise.all([
      this.uow.repos.allocations.findMany({ limit: 1, filters: { timeOffTypeId: input.id } }),
      this.uow.repos.requests.findMany({ limit: 1, filters: { timeOffTypeId: input.id } }),
    ])

    if (allocations.total > 0 || requests.total > 0) {
      return Err(
        DomainError.conflict(
          'TIME_OFF_TYPE_IN_USE',
          'This type has allocations or requests against it. Deactivate it instead of deleting.',
        ),
      )
    }

    const deleted = await this.uow.repos.types.delete(input.id)
    if (!deleted) {
      return Err(DomainError.notFound('TIME_OFF_TYPE_NOT_FOUND', 'That leave type does not exist'))
    }
    return Ok(true)
  }
}
