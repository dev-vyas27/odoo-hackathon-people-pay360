/**
 * Mongoose model for Contract. Infrastructure-only: nothing here leaks past
 * the repository's `toDomain` mapper.
 *
 * References to other aggregates (employee, department, salary structure,
 * working schedule) are stored as plain id strings rather than populated
 * refs -- modules talk to each other through ports, never through Mongoose
 * `.populate()` reaching across module boundaries.
 */
import { Schema, model, models, type Model } from 'mongoose'

export interface ContractDoc {
  _id: unknown
  employeeId: string
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  end: Date | null
  createdAt: Date
  updatedAt: Date
}

const contractSchema = new Schema<ContractDoc>(
  {
    employeeId: { type: String, required: true, index: true },
    wage: { type: Number, required: true, min: 0 },
    salaryStructureId: { type: String, default: null },
    workingScheduleId: { type: String, default: null },
    departmentId: { type: String, default: null },
    jobPositionName: { type: String, default: null },
    start: { type: Date, required: true },
    end: { type: Date, default: null },
  },
  { timestamps: true },
)

contractSchema.index({ employeeId: 1, start: -1 })

export const ContractModel: Model<ContractDoc> =
  (models.Contract as Model<ContractDoc> | undefined) ?? model<ContractDoc>('Contract', contractSchema)
