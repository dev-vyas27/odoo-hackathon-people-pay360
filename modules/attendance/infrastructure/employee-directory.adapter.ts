

import { createEmployeeLookup } from '@/modules/people'
import type { EmployeeDirectoryPort } from '../application/ports/employee-directory.port'

export class EmployeeDirectoryAdapter implements EmployeeDirectoryPort {
  async departmentIdFor(employeeId: string): Promise<string | null> {
    const summary = await createEmployeeLookup().findById(employeeId)
    return summary?.departmentId ?? null
  }

  async workingScheduleIdFor(employeeId: string): Promise<string | null> {
    const summary = await createEmployeeLookup().findById(employeeId)
    return summary?.workingScheduleId ?? null
  }
}
