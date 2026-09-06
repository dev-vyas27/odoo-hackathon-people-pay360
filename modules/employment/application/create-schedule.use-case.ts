

import { authorize, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import { computeWeeklyHours, type ScheduleDayPattern } from '../domain/weekly-hours.service'
import type { ScheduleType, WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'

export interface CreateScheduleInput {
  actor: Actor
  name: string
  type: ScheduleType
  days: ScheduleDayPattern[]
}

export class CreateScheduleUseCase implements UseCase<CreateScheduleInput, WorkingSchedule> {
  constructor(private readonly schedules: ScheduleRepositoryPort) {}

  async execute(input: CreateScheduleInput): Promise<Result<WorkingSchedule>> {
    const auth = authorize(input.actor, 'working_schedule', 'create')
    if (!auth.ok) return auth

    const created = await this.schedules.create({
      name: input.name,
      type: input.type,
      days: input.days,
      weeklyHours: computeWeeklyHours(input.days),
    })
    return Ok(created)
  }
}
