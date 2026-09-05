/**
 * Thin wiring layer between HTTP route handlers and the use cases.
 *
 * Route handlers stay ~5 lines (parse -> call controller -> respond); this
 * file is where "parse" ends and a use case begins: it connects to Mongo,
 * resolves the repository singleton from the composition root, and executes
 * the use case with the actor + validated input.
 */
import { container, resolve } from '@/modules/shared/container'
import { Ok, type Actor, type PageQuery, type Result } from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeDetailView } from '../schemas'
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
  const { departmentId, employeeType, isActive, includeAdmins, ...page } = query.value
  const pageQuery: PageQuery = {
    ...page,
    filters: {
      ...(departmentId ? { departmentId } : {}),
      ...(employeeType ? { employeeType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      // Not a column — the repository reads it and decides whether to hide
      // administrator accounts. `buildWhere` ignores filter keys that are not
      // in the column allowlist, so it cannot leak into a WHERE clause.
      ...(includeAdmins !== undefined ? { includeAdmins } : {}),
    },
  }
  return new ListEmployeesUseCase(repo).execute({ actor, query: pageQuery })
}

export async function archiveEmployee(actor: Actor, id: string): Promise<Result<Employee>> {
  const repo = await repository()
  return new ArchiveEmployeeUseCase(repo, container().eventBus).execute({ actor, id })
}

/**
 * The detail screen's payload, flattened onto `EmployeeDetailView`.
 *
 * The use case returns `{ employee, counts }` because that is a convenient
 * shape to build. The screen is typed against a FLAT record with a `counts`
 * field, and nothing bridged the two — so `employee.name` was `undefined` on
 * the client and every input rendered empty while every select fell back to its
 * placeholder. `counts` lined up by coincidence, which is why the smart buttons
 * looked fine and made the bug read as a form problem.
 *
 * Same lesson as the attendance list: a use case's return shape is not a wire
 * format. The mapping belongs here, at the interface boundary.
 */
export async function getEmployeeDetail(
  actor: Actor,
  id: string,
): Promise<Result<EmployeeDetailView>> {
  const repo = await repository()
  const result = await new GetEmployeeDetailUseCase(repo).execute({ actor, id })
  if (!result.ok) return result

  const { employee, counts } = result.value
  return Ok({
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
    counts,
  })
}
