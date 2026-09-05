import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import { computeWeeklyHours, type ScheduleDayPattern } from '../domain/weekly-hours.service'
import type { WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'

export interface UpdateScheduleInput {
  actor: Actor
  id: string
  name?: string
  days?: ScheduleDayPattern[]
}

export class UpdateScheduleUseCase implements UseCase<UpdateScheduleInput, WorkingSchedule> {
  constructor(private readonly schedules: ScheduleRepositoryPort) {}

  async execute(input: UpdateScheduleInput): Promise<Result<WorkingSchedule>> {
    const auth = authorize(input.actor, 'working_schedule', 'update')
    if (!auth.ok) return auth

    // weeklyHours is recomputed whenever the day pattern changes -- it is
    // never taken from the caller, even implicitly via a stale field.
    const patch: Partial<WorkingSchedule> = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.days !== undefined ? { days: input.days, weeklyHours: computeWeeklyHours(input.days) } : {}),
    }

    const updated = await this.schedules.update(input.id, patch)
    if (!updated) return Err(DomainError.notFound('SCHEDULE_NOT_FOUND', 'Working schedule not found'))
    return Ok(updated)
  }
}
