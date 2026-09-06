


import { getBalance } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await getBalance(await requireActor(), parseQuery(request.url))),
  )
}
