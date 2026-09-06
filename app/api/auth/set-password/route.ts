/**
 * GET  /api/auth/set-password?token=  — is this link still valid, and whose
 * POST /api/auth/set-password         — redeem it
 *
 * PUBLIC by necessity: the whole point is that this person cannot sign in yet.
 * The token IS the authentication — 32 random bytes, single use, expiring — so
 * `proxy.ts` lists this path and the use case does the rest.
 */
import { checkSetupLink, setPassword } from '@/modules/identity'
import { handle, parseQuery, respond } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await checkSetupLink(parseQuery(request.url).token ?? '')),
  )
}

export async function POST(request: Request) {
  return handle(async () => respond(await setPassword(await request.json())))
}
