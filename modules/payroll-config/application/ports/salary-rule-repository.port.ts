/**
 * Persistence port for salary rules.
 *
 * The use cases below name this interface, never Postgres, which is what lets
 * them be unit-tested with a Map-backed fake and lets the storage engine change
 * without touching a single line of business logic.
 */
import type { IRepository } from '@/modules/shared'
import type { SalaryRule } from '../../domain/salary-rule'

export interface SalaryRuleRepositoryPort extends IRepository<SalaryRule> {
  /** Batch resolve, so building a structure does not issue one query per rule. */
  findManyByIds(ids: string[]): Promise<SalaryRule[]>

  /** Codes are the address other rules reference, so they must stay unique. */
  findByCode(code: string): Promise<SalaryRule | null>
}
