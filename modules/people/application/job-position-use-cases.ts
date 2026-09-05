import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Paged,
  type PageQuery,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { JobPosition, type JobPositionInput } from '../domain/job-position'
import type { JobPositionRepositoryPort } from './ports/job-position-repository.port'

export interface CreateJobPositionInput extends JobPositionInput {
  actor: Actor
}

export class CreateJobPositionUseCase implements UseCase<CreateJobPositionInput, JobPosition> {
  constructor(private readonly repo: JobPositionRepositoryPort) {}

  async execute(input: CreateJobPositionInput): Promise<Result<JobPosition>> {
    const gate = authorize(input.actor, 'job_position', 'create')
    if (!gate.ok) return gate

    const draft = JobPosition.create(input)
    if (!draft.ok) return draft

    return Ok(await this.repo.create(draft.value))
  }
}

export interface GetJobPositionInput {
  actor: Actor
  id: string
}

export class GetJobPositionUseCase implements UseCase<GetJobPositionInput, JobPosition> {
  constructor(private readonly repo: JobPositionRepositoryPort) {}

  async execute(input: GetJobPositionInput): Promise<Result<JobPosition>> {
    const gate = authorize(input.actor, 'job_position', 'read')
    if (!gate.ok) return gate

    const found = await this.repo.findById(input.id)
    if (!found) return Err(DomainError.notFound('JOB_POSITION_NOT_FOUND', `No job position with id ${input.id}`))
    return Ok(found)
  }
}

export interface UpdateJobPositionInput {
  actor: Actor
  id: string
  patch: Partial<JobPositionInput>
}

export class UpdateJobPositionUseCase implements UseCase<UpdateJobPositionInput, JobPosition> {
  constructor(private readonly repo: JobPositionRepositoryPort) {}

  async execute(input: UpdateJobPositionInput): Promise<Result<JobPosition>> {
    const gate = authorize(input.actor, 'job_position', 'update')
    if (!gate.ok) return gate

    const existing = await this.repo.findById(input.id)
    if (!existing) return Err(DomainError.notFound('JOB_POSITION_NOT_FOUND', `No job position with id ${input.id}`))

    const updated = existing.update(input.patch)
    if (!updated.ok) return updated

    const saved = await this.repo.update(input.id, updated.value)
    if (!saved) return Err(DomainError.notFound('JOB_POSITION_NOT_FOUND', `No job position with id ${input.id}`))
    return Ok(saved)
  }
}

export interface ListJobPositionsInput {
  actor: Actor
  query: PageQuery
}

export class ListJobPositionsUseCase implements UseCase<ListJobPositionsInput, Paged<JobPosition>> {
  constructor(private readonly repo: JobPositionRepositoryPort) {}

  async execute(input: ListJobPositionsInput): Promise<Result<Paged<JobPosition>>> {
    const gate = authorize(input.actor, 'job_position', 'read')
    if (!gate.ok) return gate
    return Ok(await this.repo.findMany(input.query))
  }
}

export interface DeleteJobPositionInput {
  actor: Actor
  id: string
}

export class DeleteJobPositionUseCase implements UseCase<DeleteJobPositionInput, boolean> {
  constructor(private readonly repo: JobPositionRepositoryPort) {}

  async execute(input: DeleteJobPositionInput): Promise<Result<boolean>> {
    const gate = authorize(input.actor, 'job_position', 'delete')
    if (!gate.ok) return gate

    const deleted = await this.repo.delete(input.id)
    if (!deleted) return Err(DomainError.notFound('JOB_POSITION_NOT_FOUND', `No job position with id ${input.id}`))
    return Ok(true)
  }
}
