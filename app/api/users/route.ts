/**
 * GET/POST /api/users — account administration. Admin only; the check is inside
 * the use case, so this file stays about parsing and responding.
 *
 * The path still reads /api/users because that is what an administrator calls
 * this screen, but the rows are employees: 0010 folded the two tables together.
 * `?hasLogin=true` narrows to the people who can actually sign in.
 */
import { createAccount, listAccounts } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listAccounts(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(await createAccount(await requireActor(), await request.json()), 201),
  )
}
