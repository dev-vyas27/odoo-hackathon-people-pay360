/**
 * POST /api/auth/forgot-password
 *
 * PUBLIC. Always returns 200 with an empty body, whether or not the address
 * belongs to an account — see RequestPasswordResetUseCase for why that matters.
 */
import { appOrigin } from '@/lib/app-url'
import { handle, respond } from '@/lib/http'
import { requestPasswordReset } from '@/modules/identity'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handle(async () =>
    respond(await requestPasswordReset(await request.json(), appOrigin(request))),
  )
}
