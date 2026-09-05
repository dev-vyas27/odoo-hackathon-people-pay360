import { z } from 'zod'
import { email, nonEmpty, optionalUuid, pageQuerySchema } from '@/modules/shared'
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
  departmentId: optionalUuid,
  managerId: optionalUuid,
  jobPositionId: optionalUuid,
  workingScheduleId: optionalUuid,
  employeeType: employeeTypeSchema,
  bankAccount: z.string().trim().max(64).optional(),
  isActive: z.boolean().optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

export const employeeQuerySchema = pageQuerySchema.extend({
  departmentId: optionalUuid,
  employeeType: employeeTypeSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /**
   * Administrator accounts are hidden from employee lists by default — they are
   * operators, not staff. See the note on `buildWhere` in
   * postgres-employee.repository.ts. This is the way back in for a screen that
   * genuinely wants every account.
   */
  includeAdmins: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type CreateEmployeeBody = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeSchema>
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>
