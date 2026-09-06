


import { z } from 'zod'
import { LEAVE_UNITS, dateField, dateRangeRefinement, nonEmpty, uuid } from '@/modules/shared'



export const timeOffTypeSchema = z.object({
  name: nonEmpty('Name', 80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Use at least 2 characters')
    .max(10, 'Keep the code short')
    
    .regex(/^[A-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  unit: z.enum(LEAVE_UNITS),
  requiresAllocation: z.boolean(),
  
  autoApprove: z.boolean(),
  isPaid: z.boolean(),
  isActive: z.boolean(),
})

export type TimeOffTypeValues = z.infer<typeof timeOffTypeSchema>



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



export const leaveRequestSchema = z
  .object({
    employeeId: uuid,
    timeOffTypeId: uuid,
    start: dateField,
    end: dateField,
    


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


export const balanceQuerySchema = z.object({
  employeeId: uuid,
  on: dateField.optional(),
})
