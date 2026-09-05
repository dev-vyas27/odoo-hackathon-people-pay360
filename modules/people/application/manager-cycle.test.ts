import { describe, expect, it } from 'vitest'
import type { Actor, PageQuery, Paged } from '@/modules/shared'
import { paged } from '@/modules/shared'
import { Employee } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'
import { UpdateEmployeeUseCase } from './update-employee.use-case'

/**
 * A loop in the reporting line is not a cosmetic problem: every walk up the
 * chain runs forever. The employee form hides the choice, but the API is
 * reachable without it, so the rule has to hold here too.
 */
const hrActor: Actor = {
  employeeId: 'emp-hr',
  role: 'hr_manager',
  email: 'hr@x.com',
  name: 'HR',
}

/** sahil <- rahul <- priya, each reporting to the one before. */
function makeRepo(): EmployeeRepositoryPort {
  const rows = new Map<string, Employee>()
  const add = (id: string, name: string, managerId: string | null) => {
    rows.set(
      id,
      Employee.fromPersistence({
        id,
        name,
        email: `${id}@x.com`,
        departmentId: null,
        managerId,
        jobPositionId: null,
        workingScheduleId: null,
        employeeType: 'full_time',
        bankAccount: null,
        isActive: true,
      }),
    )
  }
  add('sahil', 'Sahil', null)
  add('rahul', 'Rahul', 'sahil')
  add('priya', 'Priya', 'rahul')

  const repo: EmployeeRepositoryPort = {
    async findById(id: string) {
      return rows.get(id) ?? null
    },
    async findByEmail() {
      return null
    },
    async findMany(_query: PageQuery): Promise<Paged<Employee>> {
      return paged([...rows.values()], rows.size, 1, 20)
    },
    async count() {
      return rows.size
    },
    async create(data: Partial<Employee>) {
      return data as Employee
    },
    async update(id: string, data: Partial<Employee>) {
      const next = data as Employee
      rows.set(id, next)
      return next
    },
    async delete() {
      return true
    },
  }
  return repo
}

async function setManager(id: string, managerId: string) {
  return new UpdateEmployeeUseCase(makeRepo()).execute({
    actor: hrActor,
    id,
    patch: { managerId } as never,
  })
}

describe('manager cycles', () => {
  it('refuses a direct report as the manager', async () => {
    // Rahul reports to Sahil, so Rahul cannot manage Sahil.
    const result = await setManager('sahil', 'rahul')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMPLOYEE_MANAGER_CYCLE')
  })

  it('refuses an INDIRECT report as the manager', async () => {
    // Priya -> Rahul -> Sahil. Priya managing Sahil closes a three-node loop,
    // which no row-level constraint can express.
    const result = await setManager('sahil', 'priya')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMPLOYEE_MANAGER_CYCLE')
  })

  it('refuses self-management', async () => {
    const result = await setManager('rahul', 'rahul')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMPLOYEE_SELF_MANAGED')
  })

  it('allows a manager who is not below the employee', async () => {
    // Sahil is above Priya, so Sahil managing Priya directly is fine.
    const result = await setManager('priya', 'sahil')
    expect(result.ok, JSON.stringify(result)).toBe(true)
  })

  it('allows an unrelated employee', async () => {
    const result = await setManager('rahul', 'sahil')
    expect(result.ok).toBe(true)
  })
})
