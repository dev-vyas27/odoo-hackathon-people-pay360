/**
 * Storage contracts for the three Time Off aggregates.
 *
 * They are grouped in one file because they are one module's private plumbing
 * and always change together; splitting them would be three files with two
 * lines each and no extra clarity.
 *
 * Every method is one the use cases actually call. Note `findForEmployee` on the
 * allocation repository: the alternative is loading every allocation in the
 * company and filtering in memory, which works at demo scale and falls over at
 * real scale — the shape of the port is where that decision gets made.
 */
import type { PageQuery, Paged, Period } from '@/modules/shared'
import type { Allocation, AllocationProps } from '../../domain/allocation'
import type { LeaveRequest, LeaveRequestProps } from '../../domain/leave-request'
import type { TimeOffType, TimeOffTypeProps } from '../../domain/time-off-type'

export interface TimeOffTypeRepositoryPort {
  findById(id: string): Promise<TimeOffType | null>
  findAll(activeOnly?: boolean): Promise<TimeOffType[]>
  findMany(query: PageQuery): Promise<Paged<TimeOffType>>
  create(props: Omit<TimeOffTypeProps, 'id'>): Promise<TimeOffType>
  update(id: string, props: Partial<Omit<TimeOffTypeProps, 'id'>>): Promise<TimeOffType | null>
  delete(id: string): Promise<boolean>
}

export interface AllocationRepositoryPort {
  findById(id: string): Promise<Allocation | null>
  findMany(query: PageQuery): Promise<Paged<Allocation>>
  /** Every allocation belonging to one employee, optionally for one type. */
  findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<Allocation[]>
  create(props: Omit<AllocationProps, 'id'>): Promise<Allocation>
  /** Persist a mutated aggregate. Takes the whole thing, not a patch. */
  save(allocation: Allocation): Promise<Allocation>
  delete(id: string): Promise<boolean>
}

export interface LeaveRequestRepositoryPort {
  findById(id: string): Promise<LeaveRequest | null>
  findMany(query: PageQuery): Promise<Paged<LeaveRequest>>
  findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<LeaveRequest[]>
  /** Approved requests intersecting a period — the dashboard's leave figure. */
  findApprovedInPeriod(period: Period, employeeIds?: string[]): Promise<LeaveRequest[]>
  countByStatus(status: string): Promise<number>
  create(props: Omit<LeaveRequestProps, 'id'>): Promise<LeaveRequest>
  save(request: LeaveRequest): Promise<LeaveRequest>
  delete(id: string): Promise<boolean>
}
