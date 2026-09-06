import type { IRepository } from '@/modules/shared'
import type { Employee } from '../../domain/employee'

export interface EmployeeRepositoryPort extends IRepository<Employee> {
  findByEmail(email: string): Promise<Employee | null>
}
