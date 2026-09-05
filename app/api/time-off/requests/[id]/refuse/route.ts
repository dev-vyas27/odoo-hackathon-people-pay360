/**
 * POST /api/time-off/requests/[id]/refuse
 *
 * Refusing an already-approved request restores the balance it consumed.
 */
import { refuseLeave } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await refuseLeave(await requireActor(), id))
  })
}
