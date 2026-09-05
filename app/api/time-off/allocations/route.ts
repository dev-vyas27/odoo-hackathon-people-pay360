/**
 * GET  /api/time-off/allocations — balances with taken/remaining/validity (A4)
 * POST /api/time-off/allocations — grant an entitlement
 *
 * A new allocation is NOT immediately spendable: the spec requires approval
 * before availability, so it lands in `to_approve`.
 */
import { allocate, listAllocations } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listAllocations(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(await allocate(await requireActor(), await request.json()), 201),
  )
}
