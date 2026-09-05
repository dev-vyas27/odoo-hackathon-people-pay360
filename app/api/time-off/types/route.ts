/**
 * GET  /api/time-off/types — configured leave policies (spec A4)
 * POST /api/time-off/types
 */
import { createTimeOffType, listTimeOffTypes } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listTimeOffTypes(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(await createTimeOffType(await requireActor(), await request.json()), 201),
  )
}
