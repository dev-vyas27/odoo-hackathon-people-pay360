

export interface EmployeeDirectoryPort {
  departmentIdFor(employeeId: string): Promise<string | null>
  workingScheduleIdFor(employeeId: string): Promise<string | null>
}
