


import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import type { JobPositionRepositoryPort } from '../application/ports/job-position-repository.port'
import { JobPosition } from '../domain/job-position'
import { JOB_POSITIONS_TABLE, JOB_POSITION_COLUMNS, type JobPositionRow } from './people.tables'

export class PostgresJobPositionRepository
  extends BaseSqlRepository<JobPosition, JobPositionRow>
  implements JobPositionRepositoryPort
{
  protected readonly table = JOB_POSITIONS_TABLE
  protected readonly columns = JOB_POSITION_COLUMNS
  protected readonly searchable = ['name']
  protected readonly defaultSort = 'name'

  protected toDomain(row: JobPositionRow): JobPosition {
    return JobPosition.fromPersistence({
      id: row.id,
      title: row.name,
      departmentId: row.department_id,
    })
  }

  private toRow(p: Partial<JobPosition>): Record<string, SqlValue> {
    const pos = p as JobPosition
    return {
      name: pos.title,
      department_id: pos.departmentId ?? null,
    }
  }

  async create(data: Partial<JobPosition>): Promise<JobPosition> {
    return this.insertRow(this.toRow(data))
  }

  async update(id: string, data: Partial<JobPosition>): Promise<JobPosition | null> {
    return this.updateRow(id, this.toRow(data))
  }
}
