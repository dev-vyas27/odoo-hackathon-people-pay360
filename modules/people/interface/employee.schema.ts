import { z } from 'zod'
import { email, nonEmpty, optionalUuid, pageQuerySchema } from '@/modules/shared'
import { EMPLOYEE_TYPES } from '../domain/employee-type'



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
  


  includeAdmins: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export type CreateEmployeeBody = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeSchema>
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>
