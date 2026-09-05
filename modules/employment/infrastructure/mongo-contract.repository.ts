/**
 * MongoContractRepository — the write-side ContractRepositoryPort.
 *
 * Overrides `create`/`update` from BaseMongoRepository because the domain
 * `Contract.wage` is a `Money` value object while the document stores a plain
 * major-units number; the base class's generic passthrough cannot know that
 * conversion. Everything else (findMany, count, delete, pagination) is
 * inherited unchanged.
 */
import { Money } from '@/modules/shared'
import { BaseMongoRepository } from '@/modules/shared'
import type { Contract } from '../domain/contract'
import type { ContractRepositoryPort } from '../application/ports/contract-repository.port'
import { ContractModel, type ContractDoc } from './contract.model'

export class MongoContractRepository
  extends BaseMongoRepository<Contract, ContractDoc>
  implements ContractRepositoryPort
{
  constructor() {
    super(ContractModel, ['jobPositionName'])
  }

  protected toDomain(doc: ContractDoc): Contract {
    return {
      id: String(doc._id),
      employeeId: doc.employeeId,
      wage: Money.of(doc.wage),
      salaryStructureId: doc.salaryStructureId,
      workingScheduleId: doc.workingScheduleId,
      departmentId: doc.departmentId,
      jobPositionName: doc.jobPositionName,
      start: doc.start,
      end: doc.end,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }

  async findByEmployee(employeeId: string): Promise<Contract[]> {
    const docs = await this.model.find({ employeeId }).sort({ start: -1 }).lean<ContractDoc[]>().exec()
    return docs.map((d) => this.toDomain(d))
  }

  override async create(data: Partial<Contract>): Promise<Contract> {
    const doc = await this.model.create(toDocInput(data))
    return this.toDomain(doc.toObject() as ContractDoc)
  }

  override async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, toDocInput(data), { new: true, runValidators: true })
      .lean<ContractDoc>()
      .exec()
    return doc ? this.toDomain(doc) : null
  }
}

/** Convert the domain-shaped partial (Money) into the document-shaped partial (number). */
function toDocInput(data: Partial<Contract>): Partial<ContractDoc> {
  const { wage, ...rest } = data
  return {
    ...rest,
    ...(wage !== undefined ? { wage: wage.toNumber() } : {}),
  }
}
