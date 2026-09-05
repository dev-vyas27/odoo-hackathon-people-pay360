/**
 * GET/POST /api/users — user administration. Admin only; the check is inside
 * the use case, so this file stays about parsing and responding.
 *
 * POST creates the account WITHOUT a password and emails a set-password link.
 * The response reports whether that email actually went out, and carries the
 * link so an admin can pass it on when SMTP is not configured.
 */
import { createAccount, listAccounts } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { appOrigin } from '@/lib/app-url'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listAccounts(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(
      await createAccount(await requireActor(), await request.json(), appOrigin(request)),
      201,
    ),
  )
}
