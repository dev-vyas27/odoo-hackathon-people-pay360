

import { z } from 'zod'
import { nonEmpty, timeField } from '@/modules/shared'
import { SCHEDULE_TYPES } from '../domain/working-schedule'

const scheduleDaySchema = z.object({
  day: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  start: timeField,
  end: timeField,
  breakMinutes: z.number().int().min(0).max(600),
})

const scheduleTypeSchema = z.enum(SCHEDULE_TYPES)

export const createScheduleSchema = z.object({
  name: nonEmpty('Schedule name'),
  type: scheduleTypeSchema,
  days: z.array(scheduleDaySchema).min(1, 'Add at least one working day'),
})

export const updateScheduleSchema = z.object({
  name: nonEmpty('Schedule name').optional(),
  type: scheduleTypeSchema.optional(),
  days: z.array(scheduleDaySchema).min(1, 'Add at least one working day').optional(),
})

export type CreateScheduleBody = z.infer<typeof createScheduleSchema>
export type UpdateScheduleBody = z.infer<typeof updateScheduleSchema>
