import { BaseMongoRepository } from '@/modules/shared'
import type { WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from '../application/ports/schedule-repository.port'
import { WorkingScheduleModel, type WorkingScheduleDoc } from './schedule.model'

export class MongoScheduleRepository
  extends BaseMongoRepository<WorkingSchedule, WorkingScheduleDoc>
  implements ScheduleRepositoryPort
{
  constructor() {
    super(WorkingScheduleModel, ['name'])
  }

  protected toDomain(doc: WorkingScheduleDoc): WorkingSchedule {
    return {
      id: String(doc._id),
      name: doc.name,
      days: doc.days,
      weeklyHours: doc.weeklyHours,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }
}
