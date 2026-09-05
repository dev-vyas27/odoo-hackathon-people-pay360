import { z } from 'zod'
import { nonEmpty, optionalObjectId, pageQuerySchema } from '@/modules/shared'

export const createJobPositionSchema = z.object({
  title: nonEmpty('Job position title'),
  departmentId: optionalObjectId,
})

export const updateJobPositionSchema = createJobPositionSchema.partial()

export const jobPositionQuerySchema = pageQuerySchema

export type CreateJobPositionBody = z.infer<typeof createJobPositionSchema>
export type UpdateJobPositionBody = z.infer<typeof updateJobPositionSchema>
