/**
 * Analytics' controller: parse the filters, run the use case, return a Result.
 */
import { DomainError, Err, type Actor, type Result } from '@/modules/shared'
import {
  GetDashboardUseCase,
  type DashboardView,
} from '../application/get-dashboard.use-case'
import { resolvePeriod } from '../domain/dashboard-metrics'
import { dashboardFilterSchema } from './dashboard.schema'

export async function getDashboard(
  actor: Actor,
  params: Record<string, string>,
): Promise<Result<DashboardView>> {
  const parsed = dashboardFilterSchema.safeParse({
    period: params.period || undefined,
    // '' is what a cleared <select> submits; it means "no filter".
    departmentId: params.departmentId || undefined,
    employeeType: params.employeeType || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.map(String).join('.') || '_'] ??= issue.message
    }
    return Err(
      DomainError.validation('VALIDATION_FAILED', 'Check the dashboard filters', fieldErrors),
    )
  }

  return new GetDashboardUseCase().execute({
    actor,
    filters: {
      period: resolvePeriod(parsed.data.period, new Date()),
      departmentId: parsed.data.departmentId,
      employeeType: parsed.data.employeeType,
    },
  })
}
