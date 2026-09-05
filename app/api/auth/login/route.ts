/**
 * POST /api/auth/login — exchange credentials for a session cookie.
 *
 * Public: `proxy.ts` lists this path so an unauthenticated request reaches it.
 */
import { login } from '@/modules/identity'
import { setAuthCookie, signToken } from '@/lib/auth'
import { errorResponse, handle } from '@/lib/http'

export async function POST(request: Request) {
  return handle(async () => {
    const result = await login(await request.json())
    if (!result.ok) return errorResponse(result.error)

    const user = result.value
    await setAuthCookie(
      signToken({
        sub: user.userId,
        employeeId: user.employeeId,
        role: user.role,
        email: user.email,
        name: user.name,
      }),
    )
    return Response.json({ data: user })
  })
}
