/**
 * POST /api/auth/logout — drop the session cookie.
 *
 * POST rather than GET on purpose: a GET logout can be triggered by an <img>
 * tag on any page on the internet.
 */
import { clearAuthCookie } from '@/lib/auth'
import { handle } from '@/lib/http'

export async function POST() {
  return handle(async () => {
    await clearAuthCookie()
    return Response.json({ data: { ok: true } })
  })
}
