


import type { Paged, PageQuery } from '@/modules/shared'
import type { Attendance } from '../../domain/attendance'
import type { AttendanceStatus } from '../../domain/exception'

export interface AttendanceFilter {
  employeeId?: string
  
  from?: Date
  to?: Date
  status?: AttendanceStatus
}



export interface AttendanceRecord {
  attendance: Attendance
  status: AttendanceStatus
}

export interface AttendanceRepositoryPort {
  


  findById(id: string): Promise<AttendanceRecord | null>
  
  findOpenForEmployee(employeeId: string): Promise<Attendance | null>
  


  findForEmployeeOnDay(employeeId: string, workedOn: Date): Promise<AttendanceRecord | null>
  


  closeStaleOpenShifts(before: Date): Promise<number>
  


  save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance>
  findMany(filter: AttendanceFilter, page: PageQuery): Promise<Paged<AttendanceRecord>>
  deleteById(id: string): Promise<boolean>
}
