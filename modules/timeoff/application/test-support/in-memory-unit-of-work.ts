

import { paged, type PageQuery, type Paged, type Period } from '@/modules/shared'
import { Allocation, type AllocationProps } from '../../domain/allocation'
import { LeaveRequest, type LeaveRequestProps } from '../../domain/leave-request'
import { TimeOffType, type TimeOffTypeProps } from '../../domain/time-off-type'
import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from '../ports/repositories.port'
import type { TimeOffRepositories, UnitOfWorkPort } from '../ports/unit-of-work.port'

class InMemoryTimeOffTypeRepository implements TimeOffTypeRepositoryPort {
  rows = new Map<string, TimeOffType>()
  private seq = 0

  seed(props: Omit<TimeOffTypeProps, 'id'> & { id?: string }): TimeOffType {
    const id = props.id ?? `type-${++this.seq}`
    const type = TimeOffType.from({ ...props, id })
    this.rows.set(id, type)
    return type
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async findAll(activeOnly = false) {
    const all = [...this.rows.values()]
    return activeOnly ? all.filter((t) => t.isActive) : all
  }
  async findMany(query: PageQuery): Promise<Paged<TimeOffType>> {
    const items = [...this.rows.values()]
    return paged(items, items.length, query.page ?? 1, query.limit ?? 20)
  }
  async create(props: Omit<TimeOffTypeProps, 'id'>) {
    return this.seed(props)
  }
  async update(id: string, props: Partial<Omit<TimeOffTypeProps, 'id'>>) {
    const existing = this.rows.get(id)
    if (!existing) return null
    const updated = TimeOffType.from({ ...existing.toView(), ...props, id })
    this.rows.set(id, updated)
    return updated
  }
  async delete(id: string) {
    return this.rows.delete(id)
  }
}

class InMemoryAllocationRepository implements AllocationRepositoryPort {
  rows = new Map<string, Allocation>()
  private seq = 0

  seed(props: Omit<AllocationProps, 'id'> & { id?: string }): Allocation {
    const id = props.id ?? `alloc-${++this.seq}`
    const allocation = Allocation.from({ ...props, id })
    this.rows.set(id, allocation)
    return allocation
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async findByIdForUpdate(id: string) {
    return this.rows.get(id) ?? null
  }
  async findMany(query: PageQuery): Promise<Paged<Allocation>> {
    const items = [...this.rows.values()]
    return paged(items, items.length, query.page ?? 1, query.limit ?? 20)
  }
  async findForEmployee(employeeId: string, timeOffTypeId?: string) {
    return [...this.rows.values()].filter(
      (a) => a.employeeId === employeeId && (!timeOffTypeId || a.timeOffTypeId === timeOffTypeId),
    )
  }
  async create(props: Omit<AllocationProps, 'id'>) {
    return this.seed(props)
  }
  async save(allocation: Allocation) {
    this.rows.set(allocation.id, allocation)
    return allocation
  }
  async delete(id: string) {
    return this.rows.delete(id)
  }
}

class InMemoryLeaveRequestRepository implements LeaveRequestRepositoryPort {
  rows = new Map<string, LeaveRequest>()
  private seq = 0

  seed(props: Omit<LeaveRequestProps, 'id'> & { id?: string }): LeaveRequest {
    const id = props.id ?? `req-${++this.seq}`
    const request = LeaveRequest.from({ ...props, id })
    this.rows.set(id, request)
    return request
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async findByIdForUpdate(id: string) {
    return this.rows.get(id) ?? null
  }
  async findMany(query: PageQuery): Promise<Paged<LeaveRequest>> {
    const items = [...this.rows.values()]
    return paged(items, items.length, query.page ?? 1, query.limit ?? 20)
  }
  async findForEmployee(employeeId: string, timeOffTypeId?: string) {
    return [...this.rows.values()].filter(
      (r) => r.employeeId === employeeId && (!timeOffTypeId || r.timeOffTypeId === timeOffTypeId),
    )
  }
  async findApprovedInPeriod(period: Period, employeeIds?: string[]) {
    return [...this.rows.values()].filter(
      (r) =>
        r.status === 'approved' &&
        r.period.overlaps(period) &&
        (!employeeIds || employeeIds.includes(r.employeeId)),
    )
  }
  async countByStatus(status: string) {
    return [...this.rows.values()].filter((r) => r.status === status).length
  }
  async create(props: Omit<LeaveRequestProps, 'id'>) {
    return this.seed(props)
  }
  async save(request: LeaveRequest) {
    this.rows.set(request.id, request)
    return request
  }
  async delete(id: string) {
    return this.rows.delete(id)
  }
}

export class InMemoryUnitOfWork implements UnitOfWorkPort {
  readonly types = new InMemoryTimeOffTypeRepository()
  readonly allocations = new InMemoryAllocationRepository()
  readonly requests = new InMemoryLeaveRequestRepository()

  get repos(): TimeOffRepositories {
    return { types: this.types, allocations: this.allocations, requests: this.requests }
  }

  

  async transaction<T>(work: (repos: TimeOffRepositories) => Promise<T>): Promise<T> {
    const snapshot = {
      types: new Map(this.types.rows),
      allocations: new Map(this.allocations.rows),
      requests: new Map(this.requests.rows),
    }
    try {
      return await work(this.repos)
    } catch (reason) {
      this.types.rows = snapshot.types
      this.allocations.rows = snapshot.allocations
      this.requests.rows = snapshot.requests
      throw reason
    }
  }
}
