import type { NextRequest } from 'next/server'
import { requireActor } from '@/lib/auth'
import { handle, respond, parsePageQuery } from '@/lib/http'
import { createScheduleSchema, listSchedules, createSchedule } from '@/modules/employment'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const actor = await requireActor()
    // See the note in app/api/contracts/route.ts: parsing with pageQuerySchema
    // discards every non-paging filter.
    return respond(await listSchedules(actor, parsePageQuery(req.url)))
  })
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireActor()
    const body = createScheduleSchema.parse(await req.json())
    return respond(await createSchedule(actor, body), 201)
  })
}
