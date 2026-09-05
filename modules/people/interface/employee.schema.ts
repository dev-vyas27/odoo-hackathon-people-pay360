import { z } from 'zod'
import { email, nonEmpty, optionalObjectId, pageQuerySchema } from '@/modules/shared'
import { EMPLOYEE_TYPES } from '../domain/employee-type'

/**
 * Single source of truth for what a valid employee payload looks like.
 * Imported by both the route handler (server) — there is no client form yet
 * in this backend-only slice, but the contract is ready for one.
 */
export const employeeTypeSchema = z.enum(EMPLOYEE_TYPES)

export const createEmployeeSchema = z.object({
  name: nonEmpty('Name'),
  email,
  departmentId: optionalObjectId,
  managerId: optionalObjectId,
  jobPositionId: optionalObjectId,
  workingScheduleId: optionalObjectId,
  employeeType: employeeTypeSchema,
  bankAccount: z.string().trim().max(64).optional(),
  isActive: z.boolean().optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

export const employeeQuerySchema = pageQuerySchema.extend({
  departmentId: optionalObjectId,
  employeeType: employeeTypeSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type CreateEmployeeBody = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeSchema>
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>
