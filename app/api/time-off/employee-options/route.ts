/**
 * GET /api/time-off/employee-options — the employee dropdown for Time Off forms.
 *
 * Reads through `EmployeeLookupPort`, so this stays correct whether the port is
 * backed by Dev B's module or the interim adapter.
 */
import { listEmployeeOptions } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function GET() {
  return handle(async () => respond(await listEmployeeOptions(await requireActor())))
}
