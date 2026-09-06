/**
 * Working-schedule request schemas.
 *
 * `weeklyHours` is deliberately absent: it is always computed server-side by
 * `computeWeeklyHours`, never accepted from a client payload.
 */
import { z } from 'zod'
import { nonEmpty, timeField } from '@/modules/shared'

const scheduleDaySchema = z.object({
  day: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  start: timeField,
  end: timeField,
  breakMinutes: z.number().int().min(0).max(600),
})

export const createScheduleSchema = z.object({
  name: nonEmpty('Schedule name'),
  days: z.array(scheduleDaySchema).min(1, 'Add at least one working day'),
})

export const updateScheduleSchema = z.object({
  name: nonEmpty('Schedule name').optional(),
  days: z.array(scheduleDaySchema).min(1, 'Add at least one working day').optional(),
})

export type CreateScheduleBody = z.infer<typeof createScheduleSchema>
export type UpdateScheduleBody = z.infer<typeof updateScheduleSchema>
