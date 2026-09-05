import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'

export interface DeleteScheduleInput {
  actor: Actor
  id: string
}

export class DeleteScheduleUseCase implements UseCase<DeleteScheduleInput, true> {
  constructor(private readonly schedules: ScheduleRepositoryPort) {}

  async execute(input: DeleteScheduleInput): Promise<Result<true>> {
    const auth = authorize(input.actor, 'working_schedule', 'delete')
    if (!auth.ok) return auth

    const deleted = await this.schedules.delete(input.id)
    if (!deleted) return Err(DomainError.notFound('SCHEDULE_NOT_FOUND', 'Working schedule not found'))
    return Ok(true)
  }
}
