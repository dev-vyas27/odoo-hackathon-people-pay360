/**
 * Thin wiring layer between HTTP route handlers and the use cases.
 *
 * Route handlers stay ~5 lines (parse -> call controller -> respond); this
 * file is where "parse" ends and a use case begins: it connects to Mongo,
 * resolves the repository singleton from the composition root, and executes
 * the use case with the actor + validated input.
 */
import { container, resolve } from '@/modules/shared/container'
import type { Actor, PageQuery, Result } from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeDetail } from '../application/get-employee-detail.use-case'
import { CreateEmployeeUseCase } from '../application/create-employee.use-case'
import { UpdateEmployeeUseCase } from '../application/update-employee.use-case'
import { ListEmployeesUseCase } from '../application/list-employees.use-case'
import { ArchiveEmployeeUseCase } from '../application/archive-employee.use-case'
import { GetEmployeeDetailUseCase } from '../application/get-employee-detail.use-case'
import { PostgresEmployeeRepository } from '../infrastructure/postgres-employee.repository'
import { createEmployeeSchema, employeeQuerySchema, updateEmployeeSchema } from './employee.schema'
import { parseWith } from './parse'

async function repository(): Promise<PostgresEmployeeRepository> {
  return resolve('people.employeeRepository', () => new PostgresEmployeeRepository())
}

export async function createEmployee(actor: Actor, rawBody: unknown): Promise<Result<Employee>> {
  const body = parseWith(createEmployeeSchema, rawBody)
  if (!body.ok) return body
  const repo = await repository()
  return new CreateEmployeeUseCase(repo).execute({ actor, ...body.value })
}

export async function updateEmployee(actor: Actor, id: string, rawPatch: unknown): Promise<Result<Employee>> {
  const patch = parseWith(updateEmployeeSchema, rawPatch)
  if (!patch.ok) return patch
  const repo = await repository()
  return new UpdateEmployeeUseCase(repo).execute({ actor, id, patch: patch.value })
}

export async function listEmployees(actor: Actor, rawQuery: Record<string, string>) {
  const query = parseWith(employeeQuerySchema, rawQuery)
  if (!query.ok) return query
  const repo = await repository()
  const { departmentId, employeeType, isActive, ...page } = query.value
  const pageQuery: PageQuery = {
    ...page,
    filters: {
      ...(departmentId ? { departmentId } : {}),
      ...(employeeType ? { employeeType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  }
  return new ListEmployeesUseCase(repo).execute({ actor, query: pageQuery })
}

export async function archiveEmployee(actor: Actor, id: string): Promise<Result<Employee>> {
  const repo = await repository()
  return new ArchiveEmployeeUseCase(repo, container().eventBus).execute({ actor, id })
}

export async function getEmployeeDetail(actor: Actor, id: string): Promise<Result<EmployeeDetail>> {
  const repo = await repository()
  return new GetEmployeeDetailUseCase(repo).execute({ actor, id })
}
