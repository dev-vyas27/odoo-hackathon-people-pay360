


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
  


  findByIdForUpdate(id: string): Promise<Allocation | null>
  findMany(query: PageQuery): Promise<Paged<Allocation>>
  
  findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<Allocation[]>
  create(props: Omit<AllocationProps, 'id'>): Promise<Allocation>
  
  save(allocation: Allocation): Promise<Allocation>
  delete(id: string): Promise<boolean>
}

export interface LeaveRequestRepositoryPort {
  findById(id: string): Promise<LeaveRequest | null>
  
  findByIdForUpdate(id: string): Promise<LeaveRequest | null>
  findMany(query: PageQuery): Promise<Paged<LeaveRequest>>
  findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<LeaveRequest[]>
  
  findApprovedInPeriod(period: Period, employeeIds?: string[]): Promise<LeaveRequest[]>
  countByStatus(status: string): Promise<number>
  create(props: Omit<LeaveRequestProps, 'id'>): Promise<LeaveRequest>
  save(request: LeaveRequest): Promise<LeaveRequest>
  delete(id: string): Promise<boolean>
}
