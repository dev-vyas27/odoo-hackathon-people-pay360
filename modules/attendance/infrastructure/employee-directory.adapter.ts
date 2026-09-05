/**
 * EmployeeDirectoryAdapter — bridges EmployeeDirectoryPort to the people
 * module's published EmployeeLookupPort.
 *
 * The narrow port is the point: attendance asks for two scalars, not for the
 * Employee aggregate. This adapter is the only place the two modules meet, and
 * it talks solely to people's public surface.
 */
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
