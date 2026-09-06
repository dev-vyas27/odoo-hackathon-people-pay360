/**
 * POST /api/users/[id]/revoke-login
 *
 * Clears the password hash. The employee record, and every contract, payslip
 * and leave request pointing at it, survives untouched — see
 * RevokeLoginUseCase for why that is the right shape for "they left".
 *
 * A sub-resource rather than `PATCH { hasLogin: false }`: it is an act with its
 * own rule (you may not revoke your own), not a field the client sets.
 */
import { revokeLogin } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await revokeLogin(await requireActor(), id))
  })
}
