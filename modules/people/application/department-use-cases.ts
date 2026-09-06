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
import { Department, type DepartmentInput } from '../domain/department'
import type { DepartmentRepositoryPort } from './ports/department-repository.port'

export interface CreateDepartmentInput extends DepartmentInput {
  actor: Actor
}

export class CreateDepartmentUseCase implements UseCase<CreateDepartmentInput, Department> {
  constructor(private readonly repo: DepartmentRepositoryPort) {}

  async execute(input: CreateDepartmentInput): Promise<Result<Department>> {
    const gate = authorize(input.actor, 'department', 'create')
    if (!gate.ok) return gate

    const draft = Department.create(input)
    if (!draft.ok) return draft

    return Ok(await this.repo.create(draft.value))
  }
}

export interface GetDepartmentInput {
  actor: Actor
  id: string
}

export class GetDepartmentUseCase implements UseCase<GetDepartmentInput, Department> {
  constructor(private readonly repo: DepartmentRepositoryPort) {}

  async execute(input: GetDepartmentInput): Promise<Result<Department>> {
    const gate = authorize(input.actor, 'department', 'read')
    if (!gate.ok) return gate

    const found = await this.repo.findById(input.id)
    if (!found) return Err(DomainError.notFound('DEPARTMENT_NOT_FOUND', `No department with id ${input.id}`))
    return Ok(found)
  }
}

export interface UpdateDepartmentInput {
  actor: Actor
  id: string
  patch: Partial<DepartmentInput>
}

export class UpdateDepartmentUseCase implements UseCase<UpdateDepartmentInput, Department> {
  constructor(private readonly repo: DepartmentRepositoryPort) {}

  async execute(input: UpdateDepartmentInput): Promise<Result<Department>> {
    const gate = authorize(input.actor, 'department', 'update')
    if (!gate.ok) return gate

    const existing = await this.repo.findById(input.id)
    if (!existing) return Err(DomainError.notFound('DEPARTMENT_NOT_FOUND', `No department with id ${input.id}`))

    const updated = existing.update(input.patch)
    if (!updated.ok) return updated

    const saved = await this.repo.update(input.id, updated.value)
    if (!saved) return Err(DomainError.notFound('DEPARTMENT_NOT_FOUND', `No department with id ${input.id}`))
    return Ok(saved)
  }
}

export interface ListDepartmentsInput {
  actor: Actor
  query: PageQuery
}

export class ListDepartmentsUseCase implements UseCase<ListDepartmentsInput, Paged<Department>> {
  constructor(private readonly repo: DepartmentRepositoryPort) {}

  async execute(input: ListDepartmentsInput): Promise<Result<Paged<Department>>> {
    const gate = authorize(input.actor, 'department', 'read')
    if (!gate.ok) return gate
    return Ok(await this.repo.findMany(input.query))
  }
}

export interface DeleteDepartmentInput {
  actor: Actor
  id: string
}

export class DeleteDepartmentUseCase implements UseCase<DeleteDepartmentInput, boolean> {
  constructor(private readonly repo: DepartmentRepositoryPort) {}

  async execute(input: DeleteDepartmentInput): Promise<Result<boolean>> {
    const gate = authorize(input.actor, 'department', 'delete')
    if (!gate.ok) return gate

    const deleted = await this.repo.delete(input.id)
    if (!deleted) return Err(DomainError.notFound('DEPARTMENT_NOT_FOUND', `No department with id ${input.id}`))
    return Ok(true)
  }
}
