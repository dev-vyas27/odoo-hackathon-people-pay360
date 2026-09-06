import type { IRepository } from '@/modules/shared'
import type { Department } from '../../domain/department'

export type DepartmentRepositoryPort = IRepository<Department>
