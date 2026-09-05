import type { FilterQuery } from 'mongoose'
import { BaseMongoRepository } from '@/modules/shared'
import type { PageQuery } from '@/modules/shared'
import { Employee } from '../domain/employee'
import { EmployeeModel, type EmployeeDoc } from './employee.model'
import type { EmployeeRepositoryPort } from '../application/ports/employee-repository.port'

export class MongoEmployeeRepository extends BaseMongoRepository<Employee, EmployeeDoc> implements EmployeeRepositoryPort {
  constructor() {
    super(EmployeeModel, ['name', 'email'])
  }

  protected toDomain(doc: EmployeeDoc): Employee {
    return Employee.fromPersistence({
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      departmentId: doc.departmentId ? doc.departmentId.toString() : null,
      managerId: doc.managerId ? doc.managerId.toString() : null,
      jobPositionId: doc.jobPositionId ? doc.jobPositionId.toString() : null,
      workingScheduleId: doc.workingScheduleId ? doc.workingScheduleId.toString() : null,
      employeeType: doc.employeeType,
      bankAccount: doc.bankAccount,
      isActive: doc.isActive,
    })
  }

  /** The domain's `id` filter key maps onto Mongo's `_id`; everything else passes through. */
  protected buildFilter(query: PageQuery): FilterQuery<EmployeeDoc> {
    const filters = { ...(query.filters ?? {}) }
    if ('id' in filters) {
      filters._id = filters.id
      delete filters.id
    }
    return super.buildFilter({ ...query, filters })
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const doc = await this.model.findOne({ email: email.toLowerCase() }).lean<EmployeeDoc>().exec()
    return doc ? this.toDomain(doc) : null
  }
}
