


import { z } from 'zod'
import { EMPLOYEE_TYPES, optionalUuid } from '@/modules/shared'

export const dashboardFilterSchema = z.object({
  


  period: z.string().trim().optional(),
  departmentId: optionalUuid,
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
})

export type DashboardFilterValues = z.infer<typeof dashboardFilterSchema>
