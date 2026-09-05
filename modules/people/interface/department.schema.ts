import { z } from 'zod'
import { nonEmpty, optionalObjectId, pageQuerySchema } from '@/modules/shared'

export const createDepartmentSchema = z.object({
  name: nonEmpty('Department name'),
  managerId: optionalObjectId,
  parentDepartmentId: optionalObjectId,
})

export const updateDepartmentSchema = createDepartmentSchema.partial()

export const departmentQuerySchema = pageQuerySchema

export type CreateDepartmentBody = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentBody = z.infer<typeof updateDepartmentSchema>
