import type { IRepository } from '@/modules/shared'
import type { Employee } from '../../domain/employee'

/**
 * Repository port for the Employee aggregate.
 *
 * Extends the generic IRepository with the one finder that is specific to
 * this aggregate (uniqueness checks on create/update need it) rather than
 * bloating the shared contract for every module.
 */
export interface EmployeeRepositoryPort extends IRepository<Employee> {
  findByEmail(email: string): Promise<Employee | null>
}
