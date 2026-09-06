/**
 * The dashboard filter contract — spec A7: "Flexible filtering by Period and
 * Department ... Employee Type filters enable focused analysis."
 *
 * Shared by the filter bar and the route handler, like every other form in the
 * project, so a filter the UI can set is always one the API understands.
 */
import { z } from 'zod'
import { EMPLOYEE_TYPES, optionalUuid } from '@/modules/shared'

export const dashboardFilterSchema = z.object({
  /**
   * `YYYY-MM` for a month or `YYYY` for a year. Deliberately a loose string
   * rather than a strict enum: `resolvePeriod` falls back to the current month
   * on anything it cannot read, because a mistyped URL should render the
   * dashboard rather than a validation error.
   */
  period: z.string().trim().optional(),
  departmentId: optionalUuid,
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
})

export type DashboardFilterValues = z.infer<typeof dashboardFilterSchema>
