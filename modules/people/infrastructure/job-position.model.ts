import { Schema, model, models, type Model, type Types } from 'mongoose'

export interface JobPositionDoc {
  _id: Types.ObjectId
  title: string
  departmentId: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const jobPositionSchema = new Schema<JobPositionDoc>(
  {
    title: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'people_department', default: null },
  },
  { timestamps: true },
)

export const JobPositionModel: Model<JobPositionDoc> =
  (models.people_job_position as Model<JobPositionDoc>) ??
  model<JobPositionDoc>('people_job_position', jobPositionSchema)
