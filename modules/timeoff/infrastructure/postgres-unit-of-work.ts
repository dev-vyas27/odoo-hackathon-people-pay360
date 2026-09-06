


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
  
  readonly repos: TimeOffRepositories = reposFor(pool())

  transaction<T>(work: (repos: TimeOffRepositories) => Promise<T>): Promise<T> {
    return transaction((client) => work(reposFor(client)))
  }
}
