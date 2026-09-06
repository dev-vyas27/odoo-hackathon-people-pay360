


import { z } from 'zod'
import { dateField, uuid, optionalUuid, pageQuerySchema } from '@/modules/shared'
import { WORK_MODES } from '../domain/work-mode'

export const ATTENDANCE_STATUSES = [
  'present',
  'late',
  'absent',
  'overtime',
  'missing_checkout',
  'manual',
] as const

export const checkInSchema = z.object({
  employeeId: uuid,
  checkIn: dateField.optional(),
  breakMinutes: z.number().nonnegative().optional(),
  
  workMode: z.enum(WORK_MODES).optional(),
})
export type CheckInBody = z.infer<typeof checkInSchema>

export const checkOutSchema = z.object({
  checkOut: dateField.optional(),
  breakMinutes: z.number().nonnegative().optional(),
})
export type CheckOutBody = z.infer<typeof checkOutSchema>

export const correctAttendanceSchema = z.object({
  checkIn: dateField.optional(),
  checkOut: z.union([dateField, z.null()]).optional(),
  breakMinutes: z.number().nonnegative().optional(),
})
export type CorrectAttendanceBody = z.infer<typeof correctAttendanceSchema>

export const listAttendanceQuerySchema = pageQuerySchema.extend({
  employeeId: optionalUuid,
  from: dateField.optional(),
  to: dateField.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
})
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>
