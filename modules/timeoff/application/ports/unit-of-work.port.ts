/**
 * Unit of Work — the port that makes "approve deducts the balance" atomic.
 *
 * Approving a leave request does two writes: it consumes the allocation and it
 * moves the request to `approved`. If the first lands and the second does not,
 * the employee has lost days they never took, and nothing in the system will
 * ever notice. Under Mongo that risk was structural. In Postgres it is a
 * solved problem — but only if both writes go through ONE connection inside
 * ONE transaction.
 *
 * The application layer must not know what a `PoolClient` is, so it asks for
 * this instead: "give me a set of repositories that share a transaction, run my
 * work against them, and commit or roll back as a unit". The infrastructure
 * adapter is the only thing that knows a database is involved.
 *
 * This is also what makes the use case testable: a fake unit of work that just
 * calls the callback with in-memory repositories needs no database at all.
 */
import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from './repositories.port'

/** Every Time Off repository, all bound to the same transaction. */
export interface TimeOffRepositories {
  types: TimeOffTypeRepositoryPort
  allocations: AllocationRepositoryPort
  requests: LeaveRequestRepositoryPort
}

export interface UnitOfWorkPort {
  /**
   * Runs `work` inside a transaction. Committed when the promise resolves,
   * rolled back when it rejects — including when a DomainError is thrown from
   * deep inside an aggregate, which is exactly the case that matters.
   */
  transaction<T>(work: (repos: TimeOffRepositories) => Promise<T>): Promise<T>

  /** The non-transactional repositories, for reads and single writes. */
  readonly repos: TimeOffRepositories
}
