import { describe, expect, it } from 'vitest'
import type { Actor, PageQuery, Paged } from '@/modules/shared'
import type { SalaryRule } from '../domain/salary-rule'
import type { SalaryRuleRepositoryPort } from './ports/salary-rule-repository.port'
import { ListSalaryRulesUseCase } from './list-salary-rules.use-case'

const ACTOR: Actor = {
  employeeId: 'emp-actor',
  role: 'hr_payroll_manager',
  email: 'payroll@example.com',
  name: 'Payroll Manager',
}

/** Records the query it was asked for, which is what these tests are about. */
class SpyRepository implements SalaryRuleRepositoryPort {
  lastQuery: PageQuery | null = null

  async findMany(query: PageQuery): Promise<Paged<SalaryRule>> {
    this.lastQuery = query
    return { items: [], total: 0, page: 1, limit: 20, pages: 1 }
  }
  async findById() {
    return null
  }
  async count() {
    return 0
  }
  async create(): Promise<SalaryRule> {
    throw new Error('not used')
  }
  async update() {
    return null
  }
  async delete() {
    return false
  }
  async findManyByIds() {
    return []
  }
  async findByCode() {
    return null
  }
}

describe('ListSalaryRulesUseCase', () => {
  it('lists in sequence order by default, so the list reads like a payslip', async () => {
    const repository = new SpyRepository()
    await new ListSalaryRulesUseCase(repository).execute({ actor: ACTOR, query: {} })

    expect(repository.lastQuery).toMatchObject({ sort: 'sequence', order: 'asc' })
  })

  it('does not let the query-string defaults undo that default', async () => {
    const repository = new SpyRepository()

    // Exactly what pageQuerySchema produces when no sort is requested: an
    // explicit `order` and an absent `sort`. Spreading this over the default
    // used to flip the list into createdAt-descending.
    await new ListSalaryRulesUseCase(repository).execute({
      actor: ACTOR,
      query: { page: 1, limit: 20, order: 'desc', sort: undefined },
    })

    expect(repository.lastQuery).toMatchObject({ sort: 'sequence', order: 'asc' })
  })

  it('honours an explicit sort from the caller', async () => {
    const repository = new SpyRepository()
    await new ListSalaryRulesUseCase(repository).execute({
      actor: ACTOR,
      query: { sort: 'name', order: 'desc' },
    })

    expect(repository.lastQuery).toMatchObject({ sort: 'name', order: 'desc' })
  })

  it('refuses a role without salary_rule read', async () => {
    const result = await new ListSalaryRulesUseCase(new SpyRepository()).execute({
      actor: { ...ACTOR, role: 'employee' },
      query: {},
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
