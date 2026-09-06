


import { container, resolve } from '@/modules/shared/container'
import { Ok, type Actor, type PageQuery, type Result } from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeDetailView, EmployeeListItem } from '../schemas'
import { CreateEmployeeUseCase } from '../application/create-employee.use-case'
import { UpdateEmployeeUseCase } from '../application/update-employee.use-case'
import { ListEmployeesUseCase } from '../application/list-employees.use-case'
import { ArchiveEmployeeUseCase } from '../application/archive-employee.use-case'
import { GetEmployeeDetailUseCase } from '../application/get-employee-detail.use-case'
import { PostgresEmployeeRepository } from '../infrastructure/postgres-employee.repository'
import { createEmployeeSchema, employeeQuerySchema, updateEmployeeSchema } from './employee.schema'
import { parseWith } from './parse'
import { resolvePlacement } from './placement-names'

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
  const { departmentId, employeeType, isActive, includeAdmins, ...page } = query.value
  const pageQuery: PageQuery = {
    ...page,
    filters: {
      ...(departmentId ? { departmentId } : {}),
      ...(employeeType ? { employeeType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      
      
      
      ...(includeAdmins !== undefined ? { includeAdmins } : {}),
    },
  }
  const result = await new ListEmployeesUseCase(repo).execute({ actor, query: pageQuery })
  if (!result.ok) return result

  


  const placement = await resolvePlacement(result.value.items)
  return Ok({
    ...result.value,
    items: result.value.items.map((employee): EmployeeListItem => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      departmentId: employee.departmentId ?? null,
      jobPositionId: employee.jobPositionId ?? null,
      managerId: employee.managerId ?? null,
      workingScheduleId: employee.workingScheduleId ?? null,
      employeeType: employee.employeeType,
      bankAccount: employee.bankAccount ?? null,
      isActive: employee.isActive,
      ...placement(employee),
    })),
  })
}

export async function archiveEmployee(actor: Actor, id: string): Promise<Result<Employee>> {
  const repo = await repository()
  return new ArchiveEmployeeUseCase(repo, container().eventBus).execute({ actor, id })
}



export async function getEmployeeDetail(
  actor: Actor,
  id: string,
): Promise<Result<EmployeeDetailView>> {
  const repo = await repository()
  const result = await new GetEmployeeDetailUseCase(repo).execute({ actor, id })
  if (!result.ok) return result

  const { employee, counts } = result.value
  const placement = await resolvePlacement([employee])
  return Ok({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    departmentId: employee.departmentId ?? null,
    jobPositionId: employee.jobPositionId ?? null,
    ...placement(employee),
    managerId: employee.managerId ?? null,
    workingScheduleId: employee.workingScheduleId ?? null,
    employeeType: employee.employeeType,
    bankAccount: employee.bankAccount ?? null,
    isActive: employee.isActive,
    counts,
  })
}
