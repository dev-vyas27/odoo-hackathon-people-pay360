import type { IRepository } from '@/modules/shared'
import type { JobPosition } from '../../domain/job-position'

export type JobPositionRepositoryPort = IRepository<JobPosition>
