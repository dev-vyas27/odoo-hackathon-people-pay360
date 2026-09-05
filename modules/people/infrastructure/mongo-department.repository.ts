import type { FilterQuery } from 'mongoose'
import { BaseMongoRepository } from '@/modules/shared'
import type { PageQuery } from '@/modules/shared'
import { Department } from '../domain/department'
import { DepartmentModel, type DepartmentDoc } from './department.model'
import type { DepartmentRepositoryPort } from '../application/ports/department-repository.port'

export class MongoDepartmentRepository
  extends BaseMongoRepository<Department, DepartmentDoc>
  implements DepartmentRepositoryPort
{
  constructor() {
    super(DepartmentModel, ['name'])
  }

  protected toDomain(doc: DepartmentDoc): Department {
    return Department.fromPersistence({
      id: doc._id.toString(),
      name: doc.name,
      managerId: doc.managerId ? doc.managerId.toString() : null,
      parentDepartmentId: doc.parentDepartmentId ? doc.parentDepartmentId.toString() : null,
    })
  }

  protected buildFilter(query: PageQuery): FilterQuery<DepartmentDoc> {
    const filters = { ...(query.filters ?? {}) }
    if ('id' in filters) {
      filters._id = filters.id
      delete filters.id
    }
    return super.buildFilter({ ...query, filters })
  }
}
