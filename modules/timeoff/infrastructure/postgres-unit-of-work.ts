/**
 * The Postgres unit of work.
 *
 * `transaction()` opens a connection, and every repository handed to the
 * callback is bound to THAT connection. So when `approve-leave.use-case` locks
 * an allocation, deducts from it and saves the request, all three statements are
 * in one transaction and commit or roll back together.
 *
 * `repos` (outside a transaction) are bound to the pool instead, which is
 * autocommit — correct for reads and for single writes that have nothing to be
 * atomic with.
 *
 * This file is the ONLY place in the module that knows a transaction exists.
 */
import { pool, transaction } from '@/lib/db'
import type {
  TimeOffRepositories,
  UnitOfWorkPort,
} from '../application/ports/unit-of-work.port'
import {
  PostgresAllocationRepository,
  PostgresLeaveRequestRepository,
  PostgresTimeOffTypeRepository,
  type Executor,
} from './timeoff.repositories'

function reposFor(executor: Executor): TimeOffRepositories {
  return {
    types: new PostgresTimeOffTypeRepository(executor),
    allocations: new PostgresAllocationRepository(executor),
    requests: new PostgresLeaveRequestRepository(executor),
  }
}

export class PostgresUnitOfWork implements UnitOfWorkPort {
  /** Pool-bound, autocommit. Built once; the pool handles concurrency. */
  readonly repos: TimeOffRepositories = reposFor(pool())

  transaction<T>(work: (repos: TimeOffRepositories) => Promise<T>): Promise<T> {
    return transaction((client) => work(reposFor(client)))
  }
}
