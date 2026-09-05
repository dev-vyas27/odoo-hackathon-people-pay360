/**
 * Mongoose schema for Attendance. Infrastructure-only — nothing here is
 * imported outside this folder; the repository maps documents to the
 * domain `Attendance` aggregate before handing anything back.
 *
 * `status` and `workedHours` are denormalized snapshots computed by the use
 * case at write time (it already has the resolved schedule in hand). Storing
 * them lets AttendanceStatsPort run single aggregation pipelines instead of
 * recomputing exception status per row in JavaScript.
 */
import { Schema, model, models, Types, type Document, type Model } from 'mongoose'
import type { AttendanceStatus } from '../domain/exception'

export interface AttendanceDoc extends Document {
  _id: Types.ObjectId
  employeeId: string
  departmentId: string | null
  checkIn: Date
  checkOut: Date | null
  breakMinutes: number
  manual: boolean
  status: AttendanceStatus
  workedHours: number | null
  createdAt: Date
  updatedAt: Date
}

const AttendanceSchema = new Schema<AttendanceDoc>(
  {
    employeeId: { type: String, required: true, index: true },
    departmentId: { type: String, default: null, index: true },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, default: null },
    breakMinutes: { type: Number, required: true, default: 0 },
    manual: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ['present', 'late', 'absent', 'overtime', 'missing_checkout', 'manual'],
      index: true,
    },
    workedHours: { type: Number, default: null },
  },
  { timestamps: true },
)

AttendanceSchema.index({ employeeId: 1, checkOut: 1 })
AttendanceSchema.index({ employeeId: 1, checkIn: 1 })

export const AttendanceModel: Model<AttendanceDoc> =
  (models.Attendance as Model<AttendanceDoc>) ?? model<AttendanceDoc>('Attendance', AttendanceSchema)
