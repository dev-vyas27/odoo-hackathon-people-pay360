import { describe, expect, it } from 'vitest'
import type { Actor, DomainEvent, IEventBus, PageQuery, Paged } from '@/modules/shared'
import { InMemoryEventBus, unwrap } from '@/modules/shared'
import { Employee } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'
import { CreateEmployeeUseCase } from './create-employee.use-case'
import { UpdateEmployeeUseCase } from './update-employee.use-case'
import { ListEmployeesUseCase } from './list-employees.use-case'
import { ArchiveEmployeeUseCase } from './archive-employee.use-case'
import { GetEmployeeDetailUseCase } from './get-employee-detail.use-case'


class FakeEmployeeRepository implements EmployeeRepositoryPort {
  private rows = new Map<string, Employee>()
  private seq = 0

  seed(employee: Employee): Employee {
    const id = `emp-${++this.seq}`
    const stored = Employee.fromPersistence({ ...employee, id })
    this.rows.set(id, stored)
    return stored
  }

  async findById(id: string): Promise<Employee | null> {
    return this.rows.get(id) ?? null
  }

  async findByEmail(email: string): Promise<Employee | null> {
    for (const row of this.rows.values()) if (row.email === email) return row
    return null
  }

  async findMany(query: PageQuery): Promise<Paged<Employee>> {
    let items = [...this.rows.values()]
    const filters = query.filters ?? {}
    if (filters.id) items = items.filter((e) => e.id === filters.id)
    if (filters.departmentId) items = items.filter((e) => e.departmentId === filters.departmentId)
    if (filters.employeeType) items = items.filter((e) => e.employeeType === filters.employeeType)
    if (query.search) {
      const needle = query.search.toLowerCase()
      items = items.filter(
        (e) => e.name.toLowerCase().includes(needle) || e.email.toLowerCase().includes(needle),
      )
    }
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const total = items.length
    const start = (page - 1) * limit
    return { items: items.slice(start, start + limit), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
  }

  async count(): Promise<number> {
    return this.rows.size
  }

  async create(data: Partial<Employee>): Promise<Employee> {
    const id = `emp-${++this.seq}`
    const stored = Employee.fromPersistence({
      id,
      name: data.name!,
      email: data.email!,
      departmentId: data.departmentId ?? null,
      managerId: data.managerId ?? null,
      jobPositionId: data.jobPositionId ?? null,
      workingScheduleId: data.workingScheduleId ?? null,
      employeeType: data.employeeType!,
      bankAccount: data.bankAccount ?? null,
      isActive: data.isActive ?? true,
    })
    this.rows.set(id, stored)
    return stored
  }

  async update(id: string, data: Partial<Employee>): Promise<Employee | null> {
    const existing = this.rows.get(id)
    if (!existing) return null
    const merged = Employee.fromPersistence({ ...existing, ...data, id })
    this.rows.set(id, merged)
    return merged
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id)
  }
}

const hrActor: Actor = { employeeId: 'emp-actor', role: 'hr_manager', email: 'hr@co.com', name: 'HR' }
const employeeActor = (employeeId: string): Actor => ({
  employeeId,
  role: 'employee',
  email: 'e@co.com',
  name: 'Emp',
})

const validInput = { name: 'Grace Hopper', email: 'grace@example.com', employeeType: 'full_time' as const }

describe('CreateEmployeeUseCase', () => {
  it('creates an employee for an authorized actor', async () => {
    const repo = new FakeEmployeeRepository()
    const result = await new CreateEmployeeUseCase(repo).execute({ actor: hrActor, ...validInput })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).not.toBe('')
    expect(result.value.email).toBe('grace@example.com')
  })

  it('rejects a duplicate email', async () => {
    const repo = new FakeEmployeeRepository()
    await new CreateEmployeeUseCase(repo).execute({ actor: hrActor, ...validInput })
    const result = await new CreateEmployeeUseCase(repo).execute({ actor: hrActor, ...validInput })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_EMAIL_TAKEN')
  })

  it('rejects an employee-role actor (no create permission)', async () => {
    const repo = new FakeEmployeeRepository()
    const result = await new CreateEmployeeUseCase(repo).execute({ actor: employeeActor('x'), ...validInput })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('forbidden')
  })
})

describe('UpdateEmployeeUseCase', () => {
  it('updates fields and prevents email collisions with another employee', async () => {
    const repo = new FakeEmployeeRepository()
    const created = repo.seed(unwrap(Employee.create(validInput)))
    const other = repo.seed(unwrap(Employee.create({ ...validInput, email: 'other@example.com' })))

    const ok = await new UpdateEmployeeUseCase(repo).execute({
      actor: hrActor,
      id: created.id,
      patch: { bankAccount: '123456' },
    })
    expect(ok.ok).toBe(true)

    const clash = await new UpdateEmployeeUseCase(repo).execute({
      actor: hrActor,
      id: created.id,
      patch: { email: other.email },
    })
    expect(clash.ok).toBe(false)
    if (clash.ok) return
    expect(clash.error.code).toBe('EMPLOYEE_EMAIL_TAKEN')
  })

  it('returns not_found for a missing employee', async () => {
    const repo = new FakeEmployeeRepository()
    const result = await new UpdateEmployeeUseCase(repo).execute({ actor: hrActor, id: 'missing', patch: {} })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('not_found')
  })
})

describe('ListEmployeesUseCase', () => {
  it('filters and searches for an HR actor', async () => {
    const repo = new FakeEmployeeRepository()
    repo.seed(unwrap(Employee.create(validInput)))
    repo.seed(unwrap(Employee.create({ ...validInput, email: 'other@example.com', name: 'Alan Turing' })))

    const result = await new ListEmployeesUseCase(repo).execute({ actor: hrActor, query: { search: 'turing' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.total).toBe(1)
    expect(result.value.items[0].name).toBe('Alan Turing')
  })

  it('scopes an employee-role actor to only their own record', async () => {
    const repo = new FakeEmployeeRepository()
    const mine = repo.seed(unwrap(Employee.create(validInput)))
    repo.seed(unwrap(Employee.create({ ...validInput, email: 'other@example.com' })))

    const result = await new ListEmployeesUseCase(repo).execute({ actor: employeeActor(mine.id), query: {} })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.total).toBe(1)
    expect(result.value.items[0].id).toBe(mine.id)
  })
})

describe('ArchiveEmployeeUseCase', () => {
  it('flips isActive and publishes EmployeeArchived', async () => {
    const repo = new FakeEmployeeRepository()
    const seeded = repo.seed(unwrap(Employee.create(validInput)))
    const bus: IEventBus = new InMemoryEventBus()
    const published: DomainEvent[] = []
    bus.subscribe('employee.archived', (event) => {
      published.push(event)
    })

    const result = await new ArchiveEmployeeUseCase(repo, bus).execute({ actor: hrActor, id: seeded.id })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.isActive).toBe(false)
    expect(published).toHaveLength(1)
    expect(published[0]).toMatchObject({ type: 'employee.archived', employeeId: seeded.id })
  })
})

describe('GetEmployeeDetailUseCase', () => {
  it('returns the employee plus stubbed smart-button counts', async () => {
    const repo = new FakeEmployeeRepository()
    const seeded = repo.seed(unwrap(Employee.create(validInput)))

    const result = await new GetEmployeeDetailUseCase(repo).execute({ actor: hrActor, id: seeded.id })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.employee.id).toBe(seeded.id)
    expect(result.value.counts).toEqual({ contracts: 0, attendance: 0, timeOff: 0, allocations: 0 })
  })

  it('lets an employee read their own record', async () => {
    const repo = new FakeEmployeeRepository()
    const seeded = repo.seed(unwrap(Employee.create(validInput)))

    const result = await new GetEmployeeDetailUseCase(repo).execute({
      actor: employeeActor(seeded.id),
      id: seeded.id,
    })
    expect(result.ok).toBe(true)
  })

  it('forbids an employee from reading someone else\'s record', async () => {
    const repo = new FakeEmployeeRepository()
    const seeded = repo.seed(unwrap(Employee.create(validInput)))

    const result = await new GetEmployeeDetailUseCase(repo).execute({
      actor: employeeActor('someone-else'),
      id: seeded.id,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FORBIDDEN_NOT_OWNER')
  })
})
