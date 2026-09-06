

export interface EmployeeSummary {
  id: string
  name: string
  email: string
  departmentId: string | null
  departmentName: string | null
  jobPositionName: string | null
  employeeType: 'full_time' | 'part_time' | 'contract' | 'intern'
  managerId: string | null
  workingScheduleId: string | null
  bankAccount: string | null 
  isActive: boolean
}

export interface EmployeeLookupPort {
  findById(employeeId: string): Promise<EmployeeSummary | null>
  findManyByIds(ids: string[]): Promise<EmployeeSummary[]>
  findEligible(filter: {
    departmentId?: string
    employeeType?: string
    activeOn: Date
  }): Promise<EmployeeSummary[]> 
}
