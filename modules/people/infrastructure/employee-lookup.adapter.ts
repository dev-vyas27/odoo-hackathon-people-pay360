/**
 * Real implementation of EmployeeLookupPort — the seam other modules depend
 * on (Employment, Time Off, Payroll, the dashboard).
 *
 * Queries Mongo directly (via `.populate`) rather than going through
 * MongoEmployeeRepository, because the port's shape is deliberately flatter
 * and denormalised (departmentName, jobPositionName) than the Employee
 * aggregate itself — that denormalisation is this adapter's job, not the
 * repository's.
 */
import type { Types } from 'mongoose'
import { EmployeeModel, type EmployeeDoc } from './employee.model'
import type { DepartmentDoc } from './department.model'
import type { JobPositionDoc } from './job-position.model'
import type { EmployeeLookupPort, EmployeeSummary } from '../application/ports/employee-lookup.port'

type PopulatedEmployeeDoc = Omit<EmployeeDoc, 'departmentId' | 'jobPositionId'> & {
  departmentId: Pick<DepartmentDoc, '_id' | 'name'> | null
  jobPositionId: Pick<JobPositionDoc, '_id' | 'title'> | null
}

function toSummary(doc: PopulatedEmployeeDoc & { _id: Types.ObjectId }): EmployeeSummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    departmentId: doc.departmentId ? doc.departmentId._id.toString() : null,
    departmentName: doc.departmentId ? doc.departmentId.name : null,
    jobPositionName: doc.jobPositionId ? doc.jobPositionId.title : null,
    employeeType: doc.employeeType,
    managerId: doc.managerId ? doc.managerId.toString() : null,
    workingScheduleId: doc.workingScheduleId ? doc.workingScheduleId.toString() : null,
    bankAccount: doc.bankAccount,
    isActive: doc.isActive,
  }
}

export class MongoEmployeeLookupAdapter implements EmployeeLookupPort {
  async findById(employeeId: string): Promise<EmployeeSummary | null> {
    const doc = await EmployeeModel.findById(employeeId)
      .populate<{ departmentId: Pick<DepartmentDoc, '_id' | 'name'> | null }>('departmentId', 'name')
      .populate<{ jobPositionId: Pick<JobPositionDoc, '_id' | 'title'> | null }>('jobPositionId', 'title')
      .lean<PopulatedEmployeeDoc & { _id: Types.ObjectId }>()
      .exec()
    return doc ? toSummary(doc) : null
  }

  async findManyByIds(ids: string[]): Promise<EmployeeSummary[]> {
    if (ids.length === 0) return []
    const docs = await EmployeeModel.find({ _id: { $in: ids } })
      .populate<{ departmentId: Pick<DepartmentDoc, '_id' | 'name'> | null }>('departmentId', 'name')
      .populate<{ jobPositionId: Pick<JobPositionDoc, '_id' | 'title'> | null }>('jobPositionId', 'title')
      .lean<(PopulatedEmployeeDoc & { _id: Types.ObjectId })[]>()
      .exec()
    return docs.map(toSummary)
  }

  async findEligible(filter: { departmentId?: string; employeeType?: string; activeOn: Date }): Promise<EmployeeSummary[]> {
    const query: Record<string, unknown> = { isActive: true }
    if (filter.departmentId) query.departmentId = filter.departmentId
    if (filter.employeeType) query.employeeType = filter.employeeType

    const docs = await EmployeeModel.find(query)
      .populate<{ departmentId: Pick<DepartmentDoc, '_id' | 'name'> | null }>('departmentId', 'name')
      .populate<{ jobPositionId: Pick<JobPositionDoc, '_id' | 'title'> | null }>('jobPositionId', 'title')
      .lean<(PopulatedEmployeeDoc & { _id: Types.ObjectId })[]>()
      .exec()
    return docs.map(toSummary)
  }
}

export function createEmployeeLookup(): EmployeeLookupPort {
  return new MongoEmployeeLookupAdapter()
}
