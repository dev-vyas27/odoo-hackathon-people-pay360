import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'

export interface GetScheduleInput {
  actor: Actor
  id: string
}

export class GetScheduleUseCase implements UseCase<GetScheduleInput, WorkingSchedule> {
  constructor(private readonly schedules: ScheduleRepositoryPort) {}

  async execute(input: GetScheduleInput): Promise<Result<WorkingSchedule>> {
    const auth = authorize(input.actor, 'working_schedule', 'read')
    if (!auth.ok) return auth

    const schedule = await this.schedules.findById(input.id)
    if (!schedule) return Err(DomainError.notFound('SCHEDULE_NOT_FOUND', 'Working schedule not found'))
    return Ok(schedule)
  }
}
