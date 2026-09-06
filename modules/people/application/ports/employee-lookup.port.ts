/**
 * EmployeeLookupPort — the contract other modules depend on.
 *
 * Employment, Time Off, Payroll and the dashboard never touch our repository
 * or domain types directly (the ESLint boundary rule would reject that
 * anyway). They see this flat, denormalised summary instead, so a change to
 * our aggregate's internal shape never ripples outward.
 */
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
  bankAccount: string | null // Dev C needs this for the missing-bank-details warning
  isActive: boolean
}

export interface EmployeeLookupPort {
  findById(employeeId: string): Promise<EmployeeSummary | null>
  findManyByIds(ids: string[]): Promise<EmployeeSummary[]>
  findEligible(filter: {
    departmentId?: string
    employeeType?: string
    activeOn: Date
  }): Promise<EmployeeSummary[]> // drives the Payrun wizard step 2
}
