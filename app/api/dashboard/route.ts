


import { getDashboard } from '@/modules/analytics'
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await getDashboard(await requireActor(), parseQuery(request.url))),
  )
}
