/**
 * POST /api/users/[id]/invite — send (or resend) a set-password link.
 *
 * Issuing a new link invalidates any outstanding one, so resending because the
 * first went astray genuinely revokes the first.
 */
import { inviteAccount } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { appOrigin } from '@/lib/app-url'
import { handle, respond } from '@/lib/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await inviteAccount(await requireActor(), id, appOrigin(request)))
  })
}
