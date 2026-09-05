import type { IRepository } from '@/modules/shared'
import type { WorkingSchedule } from '../../domain/working-schedule'

export type ScheduleRepositoryPort = IRepository<WorkingSchedule>
