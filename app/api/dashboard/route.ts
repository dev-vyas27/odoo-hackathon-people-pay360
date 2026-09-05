/**
 * GET /api/dashboard?period=&departmentId=&employeeType=
 *
 * The three filters spec A7 asks for. Permission is checked in the use case
 * (`dashboard:read`), and `proxy.ts` already blocks the /reports page for roles
 * that cannot read it.
 */
import { getDashboard } from '@/modules/analytics'
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await getDashboard(await requireActor(), parseQuery(request.url))),
  )
}
