/**
 * POST /api/time-off/requests/[id]/submit — send a draft for approval.
 *
 * A sub-resource rather than `PATCH { status }`: the transition is a business
 * act with its own rules, and modelling it as a field the client sets would put
 * the state machine in the caller's hands.
 */
import { submitLeave } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await submitLeave(await requireActor(), id))
  })
}
