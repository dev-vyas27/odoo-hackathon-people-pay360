


import { listLeaveRequests, requestLeave } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listLeaveRequests(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(await requestLeave(await requireActor(), await request.json()), 201),
  )
}
