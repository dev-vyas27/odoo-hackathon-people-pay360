/**
 * GET /api/auth/me — who am I, according to the cookie.
 *
 * The client uses this to decide what to render; the server never trusts the
 * answer coming back, because every other endpoint re-reads the token itself.
 */
import { me } from '@/modules/identity'
import { getActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function GET() {
  return handle(async () => respond(me(await getActor())))
}
