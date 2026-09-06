/**
 * GET /api/time-off/balance?employeeId=&on=
 *
 * Defaults to the caller's own employee record, which is what the plain
 * `employee` role wants and all they are permitted to see.
 */
import { getBalance } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await getBalance(await requireActor(), parseQuery(request.url))),
  )
}
