import type { Actor, PageQuery, Paged, Result } from '@/modules/shared'
import type { WorkingSchedule } from '../domain/working-schedule'
import { PostgresScheduleRepository } from '../infrastructure/postgres-schedule.repository'
import { CreateScheduleUseCase, type CreateScheduleInput } from '../application/create-schedule.use-case'
import { UpdateScheduleUseCase, type UpdateScheduleInput } from '../application/update-schedule.use-case'
import { ListSchedulesUseCase } from '../application/list-schedules.use-case'
import { GetScheduleUseCase } from '../application/get-schedule.use-case'
import { DeleteScheduleUseCase } from '../application/delete-schedule.use-case'

function repository() {
  return new PostgresScheduleRepository()
}

export async function listSchedules(actor: Actor, query: PageQuery): Promise<Result<Paged<WorkingSchedule>>> {
  return new ListSchedulesUseCase(repository()).execute({ actor, query })
}

export async function getSchedule(actor: Actor, id: string): Promise<Result<WorkingSchedule>> {
  return new GetScheduleUseCase(repository()).execute({ actor, id })
}

export async function createSchedule(
  actor: Actor,
  body: Omit<CreateScheduleInput, 'actor'>,
): Promise<Result<WorkingSchedule>> {
  return new CreateScheduleUseCase(repository()).execute({ actor, ...body })
}

export async function updateSchedule(
  actor: Actor,
  id: string,
  body: Omit<UpdateScheduleInput, 'actor' | 'id'>,
): Promise<Result<WorkingSchedule>> {
  return new UpdateScheduleUseCase(repository()).execute({ actor, id, ...body })
}

export async function deleteSchedule(actor: Actor, id: string): Promise<Result<true>> {
  return new DeleteScheduleUseCase(repository()).execute({ actor, id })
}
