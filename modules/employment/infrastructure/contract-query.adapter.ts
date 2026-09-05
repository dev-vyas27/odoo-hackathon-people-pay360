/**
 * ContractQueryAdapter — implements ContractQueryPort for other modules.
 *
 * `findApplicableContract` narrows the query to the Mongo level first
 * (start <= period.end AND (end is null OR end >= period.start)) so we never
 * pull an employee's whole contract history just to resolve one payroll
 * period, then applies the exact same pure `resolveApplicableContract` rule
 * the domain unit tests exercise -- there is only one implementation of the
 * resolution rule in the whole codebase.
 */
import type { Period } from '@/modules/shared'
import { resolveApplicableContract } from '../domain/contract-resolution'
import type { ContractQueryPort, ContractSnapshot } from '../application/ports/contract-query.port'
import { ContractModel, type ContractDoc } from './contract.model'

function toSnapshot(doc: ContractDoc): ContractSnapshot {
  return {
    id: String(doc._id),
    employeeId: doc.employeeId,
    wage: doc.wage,
    salaryStructureId: doc.salaryStructureId,
    workingScheduleId: doc.workingScheduleId,
    departmentId: doc.departmentId,
    jobPositionName: doc.jobPositionName,
    start: doc.start,
    end: doc.end,
  }
}

export class ContractQueryAdapter implements ContractQueryPort {
  async findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null> {
    const docs = await ContractModel.find({
      employeeId,
      start: { $lte: period.end },
      $or: [{ end: null }, { end: { $gte: period.start } }],
    })
      .lean<ContractDoc[]>()
      .exec()

    const snapshots = docs.map(toSnapshot)
    return resolveApplicableContract(snapshots, period)
  }

  async findByEmployee(employeeId: string): Promise<ContractSnapshot[]> {
    const docs = await ContractModel.find({ employeeId }).sort({ start: -1 }).lean<ContractDoc[]>().exec()
    return docs.map(toSnapshot)
  }
}
