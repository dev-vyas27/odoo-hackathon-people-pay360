import { resolve } from '@/modules/shared/container'
import type { Actor } from '@/modules/shared'
import {
  CreateDepartmentUseCase,
  DeleteDepartmentUseCase,
  GetDepartmentUseCase,
  ListDepartmentsUseCase,
  UpdateDepartmentUseCase,
} from '../application/department-use-cases'
import { PostgresDepartmentRepository } from '../infrastructure/postgres-department.repository'
import { createDepartmentSchema, departmentQuerySchema, updateDepartmentSchema } from './department.schema'
import { parseWith } from './parse'

async function repository(): Promise<PostgresDepartmentRepository> {
  return resolve('people.departmentRepository', () => new PostgresDepartmentRepository())
}

export async function createDepartment(actor: Actor, rawBody: unknown) {
  const body = parseWith(createDepartmentSchema, rawBody)
  if (!body.ok) return body
  const repo = await repository()
  return new CreateDepartmentUseCase(repo).execute({ actor, ...body.value })
}

export async function updateDepartment(actor: Actor, id: string, rawPatch: unknown) {
  const patch = parseWith(updateDepartmentSchema, rawPatch)
  if (!patch.ok) return patch
  const repo = await repository()
  return new UpdateDepartmentUseCase(repo).execute({ actor, id, patch: patch.value })
}

export async function listDepartments(actor: Actor, rawQuery: Record<string, string>) {
  const query = parseWith(departmentQuerySchema, rawQuery)
  if (!query.ok) return query
  const repo = await repository()
  return new ListDepartmentsUseCase(repo).execute({ actor, query: query.value })
}

export async function getDepartment(actor: Actor, id: string) {
  const repo = await repository()
  return new GetDepartmentUseCase(repo).execute({ actor, id })
}

export async function deleteDepartment(actor: Actor, id: string) {
  const repo = await repository()
  return new DeleteDepartmentUseCase(repo).execute({ actor, id })
}
