import { describe, expect, it } from 'vitest'
import { Money, type Actor, type Paged } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'
import { CreateContractUseCase } from './create-contract.use-case'

class FakeContractRepository implements ContractRepositoryPort {
  private rows: Contract[] = []
  private nextId = 1

  seed(contracts: Contract[]) {
    this.rows.push(...contracts)
  }

  async findByEmployee(employeeId: string): Promise<Contract[]> {
    return this.rows.filter((c) => c.employeeId === employeeId)
  }

  async findById(id: string): Promise<Contract | null> {
    return this.rows.find((c) => c.id === id) ?? null
  }

  async findMany(): Promise<Paged<Contract>> {
    return { items: this.rows, total: this.rows.length, page: 1, limit: 20, pages: 1 }
  }

  async count(): Promise<number> {
    return this.rows.length
  }

  async create(data: Partial<Contract>): Promise<Contract> {
    const now = new Date()
    const contract: Contract = {
      id: String(this.nextId++),
      employeeId: data.employeeId!,
      wage: data.wage!,
      salaryStructureId: data.salaryStructureId ?? null,
      workingScheduleId: data.workingScheduleId ?? null,
      departmentId: data.departmentId ?? null,
      jobPositionName: data.jobPositionName ?? null,
      start: data.start!,
      end: data.end ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.rows.push(contract)
    return contract
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    const idx = this.rows.findIndex((c) => c.id === id)
    if (idx === -1) return null
    this.rows[idx] = { ...this.rows[idx], ...data, updatedAt: new Date() }
    return this.rows[idx]
  }

  async delete(id: string): Promise<boolean> {
    const before = this.rows.length
    this.rows = this.rows.filter((c) => c.id !== id)
    return this.rows.length < before
  }
}

function hrManager(): Actor {
  return { employeeId: 'emp-actor', role: 'hr_manager', email: 'hr@pp360.dev', name: 'HR' }
}

function existingContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'existing',
    employeeId: 'emp-1',
    wage: Money.of(50000),
    salaryStructureId: null,
    workingScheduleId: null,
    departmentId: null,
    jobPositionName: null,
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('CreateContractUseCase', () => {
  it('creates a contract when the employee has no existing contracts', async () => {
    const repo = new FakeContractRepository()
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      employeeId: 'emp-1',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: 'Engineer',
      start: new Date('2026-01-01'),
      end: null,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.employeeId).toBe('emp-1')
      expect(result.value.wage.toNumber()).toBe(60000)
    }
  })

  it('rejects a new contract that overlaps an existing one for the same employee', async () => {
    const repo = new FakeContractRepository()
    repo.seed([existingContract()])
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      employeeId: 'emp-1',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: null,
      start: new Date('2025-06-01'), 
      end: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('conflict')
      expect(result.error.code).toBe('CONTRACT_OVERLAP')
    }
  })

  it('rejects an open-ended new contract that overlaps a fixed-term existing one', async () => {
    const repo = new FakeContractRepository()
    repo.seed([existingContract({ start: new Date('2026-01-01'), end: new Date('2026-06-30') })])
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      employeeId: 'emp-1',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: null,
      start: new Date('2026-03-01'),
      end: null,
    })

    expect(result.ok).toBe(false)
  })

  it('allows a new contract that starts the day after the previous one ends', async () => {
    const repo = new FakeContractRepository()
    repo.seed([existingContract({ start: new Date('2025-01-01'), end: new Date('2025-12-31') })])
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      employeeId: 'emp-1',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: null,
      start: new Date('2026-01-01'),
      end: null,
    })

    expect(result.ok).toBe(true)
  })

  it('does not block a contract for a different employee with the same dates', async () => {
    const repo = new FakeContractRepository()
    repo.seed([existingContract({ employeeId: 'emp-1' })])
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      employeeId: 'emp-2',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: null,
      start: new Date('2025-06-01'),
      end: null,
    })

    expect(result.ok).toBe(true)
  })

  it('rejects when the actor is not authorized to create contracts', async () => {
    const repo = new FakeContractRepository()
    const useCase = new CreateContractUseCase(repo)

    const result = await useCase.execute({
      actor: { employeeId: 'emp-9', role: 'employee', email: 'e@pp360.dev', name: 'Emp' },
      employeeId: 'emp-1',
      wage: 60000,
      salaryStructureId: null,
      workingScheduleId: null,
      departmentId: null,
      jobPositionName: null,
      start: new Date('2026-01-01'),
      end: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
