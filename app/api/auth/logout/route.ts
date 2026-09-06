


import { clearAuthCookie } from '@/lib/auth'
import { handle } from '@/lib/http'

export async function POST() {
  return handle(async () => {
    await clearAuthCookie()
    return Response.json({ data: { ok: true } })
  })
}
