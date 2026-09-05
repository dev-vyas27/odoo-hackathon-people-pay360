import type { FilterQuery } from 'mongoose'
import { BaseMongoRepository } from '@/modules/shared'
import type { PageQuery } from '@/modules/shared'
import { JobPosition } from '../domain/job-position'
import { JobPositionModel, type JobPositionDoc } from './job-position.model'
import type { JobPositionRepositoryPort } from '../application/ports/job-position-repository.port'

export class MongoJobPositionRepository
  extends BaseMongoRepository<JobPosition, JobPositionDoc>
  implements JobPositionRepositoryPort
{
  constructor() {
    super(JobPositionModel, ['title'])
  }

  protected toDomain(doc: JobPositionDoc): JobPosition {
    return JobPosition.fromPersistence({
      id: doc._id.toString(),
      title: doc.title,
      departmentId: doc.departmentId ? doc.departmentId.toString() : null,
    })
  }

  protected buildFilter(query: PageQuery): FilterQuery<JobPositionDoc> {
    const filters = { ...(query.filters ?? {}) }
    if ('id' in filters) {
      filters._id = filters.id
      delete filters.id
    }
    return super.buildFilter({ ...query, filters })
  }
}
