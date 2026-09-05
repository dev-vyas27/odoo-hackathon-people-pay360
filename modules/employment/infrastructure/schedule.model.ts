import { Schema, model, models, type Model } from 'mongoose'
import type { ScheduleDayPattern } from '../domain/weekly-hours.service'

export interface WorkingScheduleDoc {
  _id: unknown
  name: string
  days: ScheduleDayPattern[]
  weeklyHours: number
  createdAt: Date
  updatedAt: Date
}

const scheduleDaySchema = new Schema<ScheduleDayPattern>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true },
    end: { type: String, required: true },
    breakMinutes: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
)

const workingScheduleSchema = new Schema<WorkingScheduleDoc>(
  {
    name: { type: String, required: true, trim: true },
    days: { type: [scheduleDaySchema], default: [] },
    // Computed by weekly-hours.service.ts; never set directly by a form.
    weeklyHours: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
)

export const WorkingScheduleModel: Model<WorkingScheduleDoc> =
  (models.WorkingSchedule as Model<WorkingScheduleDoc> | undefined) ??
  model<WorkingScheduleDoc>('WorkingSchedule', workingScheduleSchema)
