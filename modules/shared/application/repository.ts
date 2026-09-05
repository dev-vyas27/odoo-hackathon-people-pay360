/**
 * Repository and UseCase contracts.
 *
 * Application code depends on IRepository, never on Mongoose. Swapping storage
 * (or faking it in a unit test) touches one file in infrastructure/ and nothing
 * else — that is the Dependency Inversion Principle doing actual work rather
 * than being quoted in a README.
 */
import type { Result } from '../domain/result'

export interface PageQuery {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  filters?: Record<string, unknown>
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface IReadRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>
  findMany(query: PageQuery): Promise<Paged<T>>
  count(filters?: Record<string, unknown>): Promise<number>
}

export interface IRepository<T, ID = string> extends IReadRepository<T, ID> {
  create(data: Partial<T>): Promise<T>
  update(id: ID, data: Partial<T>): Promise<T | null>
  delete(id: ID): Promise<boolean>
}

/**
 * One class, one operation (Single Responsibility).
 *
 * A use case is the only place a business transaction is orchestrated, and it
 * is trivially unit-testable because every collaborator arrives through the
 * constructor.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output>>
}

export const DEFAULT_PAGE_LIMIT = 20

export function normalizePageQuery(q: PageQuery): Required<Pick<PageQuery, 'page' | 'limit'>> & PageQuery {
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(200, Math.max(1, Number(q.limit) || DEFAULT_PAGE_LIMIT))
  return { ...q, page, limit }
}

export function paged<T>(items: T[], total: number, page: number, limit: number): Paged<T> {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
}
