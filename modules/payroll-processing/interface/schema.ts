


import { z } from 'zod'
import { dateField, nonEmpty, uuid, optionalUuid } from '@/modules/shared'
import { EMPLOYEE_TYPES } from '@/modules/shared'

export const createPayrunSchema = z
  .object({
    name: nonEmpty('Payrun name'),
    structureId: uuid,
    periodStart: dateField,
    periodEnd: dateField,
    departmentId: optionalUuid,
    employeeIds: z.array(uuid).min(1, 'Select at least one employee'),
  })
  .superRefine((values, ctx) => {
    if (values.periodEnd < values.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: 'The period end cannot be before its start',
      })
    }
  })

export type CreatePayrunValues = z.infer<typeof createPayrunSchema>


export const payrunScopeSchema = z
  .object({
    name: nonEmpty('Payrun name'),
    structureId: uuid,
    periodStart: dateField,
    periodEnd: dateField,
    departmentId: optionalUuid,
    employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.periodEnd < values.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: 'The period end cannot be before its start',
      })
    }
  })

export type PayrunScopeValues = z.infer<typeof payrunScopeSchema>


export const eligibleEmployeesQuerySchema = z.object({
  periodStart: dateField,
  periodEnd: dateField,
  departmentId: z.string().trim().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
})
