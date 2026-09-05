import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface DepartmentDoc {
  _id: Types.ObjectId
  name: string
  managerId: Types.ObjectId | null
  parentDepartmentId: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    name: { type: String, required: true, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'people_employee', default: null },
    parentDepartmentId: { type: Schema.Types.ObjectId, ref: 'people_department', default: null },
  },
  { timestamps: true },
)

export const DepartmentModel: Model<DepartmentDoc> =
  (models.people_department as Model<DepartmentDoc>) ??
  model<DepartmentDoc>('people_department', departmentSchema)
