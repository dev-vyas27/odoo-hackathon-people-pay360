/**
 * GET/POST /api/users — user administration. Admin only; the check is inside
 * the use case, so this file stays about parsing and responding.
 */
import { createUser, listUsers } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listUsers(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(await createUser(await requireActor(), await request.json()), 201),
  )
}
