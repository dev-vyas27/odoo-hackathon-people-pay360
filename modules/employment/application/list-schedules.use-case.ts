import { authorize, Ok, type Actor, type PageQuery, type Paged, type Result, type UseCase } from '@/modules/shared'
import type { WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'

export interface ListSchedulesInput {
  actor: Actor
  query: PageQuery
}

export class ListSchedulesUseCase implements UseCase<ListSchedulesInput, Paged<WorkingSchedule>> {
  constructor(private readonly schedules: ScheduleRepositoryPort) {}

  async execute(input: ListSchedulesInput): Promise<Result<Paged<WorkingSchedule>>> {
    const auth = authorize(input.actor, 'working_schedule', 'read')
    if (!auth.ok) return auth
    return Ok(await this.schedules.findMany(input.query))
  }
}
