import { describe, expect, it } from 'vitest'
import { Money, type Actor, type Paged } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from './ports/contract-repository.port'
import { UpdateContractUseCase } from './update-contract.use-case'

class FakeContractRepository implements ContractRepositoryPort {
  private rows: Contract[] = []

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

  async create(): Promise<Contract> {
    throw new Error('not used in this test')
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    const idx = this.rows.findIndex((c) => c.id === id)
    if (idx === -1) return null
    this.rows[idx] = { ...this.rows[idx], ...data, updatedAt: new Date() }
    return this.rows[idx]
  }

  async delete(): Promise<boolean> {
    return false
  }
}

function hrManager(): Actor {
  return { userId: 'u1', employeeId: null, role: 'hr_manager', email: 'hr@pp360.dev', name: 'HR' }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c1',
    employeeId: 'emp-1',
    wage: Money.of(50000),
    salaryStructureId: null,
    workingScheduleId: null,
    departmentId: null,
    jobPositionName: null,
    start: new Date('2026-01-01'),
    end: new Date('2026-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('UpdateContractUseCase', () => {
  it('updates the wage without touching the validity range', async () => {
    const repo = new FakeContractRepository()
    repo.seed([makeContract()])
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({ actor: hrManager(), id: 'c1', wage: 75000 })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.wage.toNumber()).toBe(75000)
  })

  it('returns not_found for a missing contract', async () => {
    const repo = new FakeContractRepository()
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({ actor: hrManager(), id: 'missing', wage: 1000 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('not_found')
  })

  it('does not flag itself as an overlap when only the wage changes', async () => {
    const repo = new FakeContractRepository()
    repo.seed([makeContract()])
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({ actor: hrManager(), id: 'c1', wage: 80000 })

    expect(result.ok).toBe(true)
  })

  it('rejects extending the end date into another contract for the same employee', async () => {
    const repo = new FakeContractRepository()
    repo.seed([
      makeContract({ id: 'c1', start: new Date('2026-01-01'), end: new Date('2026-06-30') }),
      makeContract({ id: 'c2', start: new Date('2026-07-01'), end: null }),
    ])
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({ actor: hrManager(), id: 'c1', end: new Date('2026-08-01') })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('conflict')
      expect(result.error.code).toBe('CONTRACT_OVERLAP')
    }
  })

  it('allows shrinking the range so it no longer overlaps a sibling contract', async () => {
    const repo = new FakeContractRepository()
    repo.seed([
      makeContract({ id: 'c1', start: new Date('2026-01-01'), end: new Date('2026-08-01') }),
      makeContract({ id: 'c2', start: new Date('2026-07-01'), end: null }),
    ])
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({ actor: hrManager(), id: 'c1', end: new Date('2026-06-30') })

    expect(result.ok).toBe(true)
  })

  it('rejects when the actor is not authorized to update contracts', async () => {
    const repo = new FakeContractRepository()
    repo.seed([makeContract()])
    const useCase = new UpdateContractUseCase(repo)

    const result = await useCase.execute({
      actor: { userId: 'u2', employeeId: 'emp-9', role: 'employee', email: 'e@pp360.dev', name: 'Emp' },
      id: 'c1',
      wage: 1000,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
