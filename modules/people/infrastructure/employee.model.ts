import { Schema, model, models, type Model, type Types } from 'mongoose'
import { EMPLOYEE_TYPES, type EmployeeType } from '../domain/employee-type'

export interface EmployeeDoc {
  _id: Types.ObjectId
  name: string
  email: string
  departmentId: Types.ObjectId | null
  managerId: Types.ObjectId | null
  jobPositionId: Types.ObjectId | null
  workingScheduleId: Types.ObjectId | null
  employeeType: EmployeeType
  bankAccount: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const employeeSchema = new Schema<EmployeeDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'people_department', default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'people_employee', default: null },
    jobPositionId: { type: Schema.Types.ObjectId, ref: 'people_job_position', default: null },
    workingScheduleId: { type: Schema.Types.ObjectId, default: null },
    employeeType: { type: String, enum: EMPLOYEE_TYPES, required: true },
    bankAccount: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const EmployeeModel: Model<EmployeeDoc> =
  (models.people_employee as Model<EmployeeDoc>) ?? model<EmployeeDoc>('people_employee', employeeSchema)
