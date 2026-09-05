/**
 * JobPosition — a titled role an employee can hold, optionally scoped to a
 * department (e.g. "Software Engineer" in "Engineering").
 */
import { DomainError } from '@/modules/shared'
import { Ok, Err, type Result } from '@/modules/shared'

export interface JobPositionInput {
  title: string
  departmentId?: string | null
}

export interface JobPositionPersistence extends JobPositionInput {
  id: string
  departmentId: string | null
}

export class JobPosition {
  private constructor(
    readonly id: string,
    readonly title: string,
    readonly departmentId: string | null,
  ) {}

  static create(input: JobPositionInput): Result<JobPosition> {
    const title = input.title.trim()
    if (!title) {
      return Err(DomainError.validation('JOB_POSITION_TITLE_REQUIRED', 'Job position title is required'))
    }
    return Ok(new JobPosition('', title, input.departmentId ?? null))
  }

  static fromPersistence(row: JobPositionPersistence): JobPosition {
    return new JobPosition(row.id, row.title, row.departmentId)
  }

  update(patch: Partial<JobPositionInput>): Result<JobPosition> {
    const title = (patch.title ?? this.title).trim()
    if (!title) {
      return Err(DomainError.validation('JOB_POSITION_TITLE_REQUIRED', 'Job position title is required'))
    }
    return Ok(
      new JobPosition(
        this.id,
        title,
        patch.departmentId !== undefined ? patch.departmentId : this.departmentId,
      ),
    )
  }
}
