


import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from './repositories.port'


export interface TimeOffRepositories {
  types: TimeOffTypeRepositoryPort
  allocations: AllocationRepositoryPort
  requests: LeaveRequestRepositoryPort
}

export interface UnitOfWorkPort {
  


  transaction<T>(work: (repos: TimeOffRepositories) => Promise<T>): Promise<T>

  
  readonly repos: TimeOffRepositories
}
