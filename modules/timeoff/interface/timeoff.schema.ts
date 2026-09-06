/**
 * The zod schemas the Time Off forms AND the Time Off route handlers share.
 *
 * One definition, two enforcement points. This is the project rule that stops
 * the classic bug where the UI accepts something the API then rejects with an
 * unhelpful 500 — the client and the server are validating the same object,
 * not two objects that used to agree.
 *
 * These are safe to import from a client component: zod only, no database.
 * See `modules/timeoff/schemas.ts`.
 */
import { z } from 'zod'
import { LEAVE_UNITS, dateField, dateRangeRefinement, nonEmpty, uuid } from '@/modules/shared'

// ── time off types ───────────────────────────────────────────────────────────

export const timeOffTypeSchema = z.object({
  name: nonEmpty('Name', 80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Use at least 2 characters')
    .max(10, 'Keep the code short')
    // Formulas and URLs carry these around, so keep them boring.
    .regex(/^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  unit: z.enum(LEAVE_UNITS),
  requiresAllocation: z.boolean(),
  /** Skip the manual approval step: a submitted request lands as approved. */
  autoApprove: z.boolean(),
  isPaid: z.boolean(),
  isActive: z.boolean(),
})

export type TimeOffTypeValues = z.infer<typeof timeOffTypeSchema>

// ── allocations ──────────────────────────────────────────────────────────────

export const allocationSchema = z
  .object({
    employeeId: uuid,
    timeOffTypeId: uuid,
    allocated: z
      .number({ message: 'Enter an amount' })
      .positive('Allocate more than zero')
      .max(999, 'That looks like a typo'),
    validFrom: dateField,
    validTo: dateField,
    note: z.string().trim().max(200).optional().or(z.literal('')),
  })
  // The shared refinement puts the error on `end`, where the user can see it.
  // Mapped because this schema calls the fields validFrom/validTo.
  .superRefine((data, ctx) => {
    dateRangeRefinement({ start: data.validFrom, end: data.validTo }, ctx)
    if (data.validTo < data.validFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'The window cannot end before it starts',
      })
    }
  })

export type AllocationValues = z.infer<typeof allocationSchema>

export const allocationDecisionSchema = z.object({
  decision: z.enum(['approve', 'refuse']),
})

// ── leave requests ───────────────────────────────────────────────────────────

export const leaveRequestSchema = z
  .object({
    employeeId: uuid,
    timeOffTypeId: uuid,
    start: dateField,
    end: dateField,
    /**
     * Optional for day leave — the domain defaults it to the inclusive length
     * of the period. Supplying it is how a half day is expressed, and it is
     * required outright for hour-based types.
     */
    duration: z
      .number()
      .positive('Duration must be more than zero')
      .max(365, 'That is longer than a year')
      .optional(),
    reason: z.string().trim().max(300).optional().or(z.literal('')),
    asDraft: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.end < data.start) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'The leave cannot end before it starts',
      })
    }
  })

export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>

/** `GET /api/time-off/balance?employeeId=&on=` */
export const balanceQuerySchema = z.object({
  employeeId: uuid,
  on: dateField.optional(),
})
