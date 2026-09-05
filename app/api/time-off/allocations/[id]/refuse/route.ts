/**
 * POST /api/time-off/allocations/[id]/refuse
 *
 * Refused if nothing has been taken against it yet — withdrawing a balance
 * somebody has already spent would leave approved leave funded by nothing.
 */
import { decideAllocation } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await decideAllocation(await requireActor(), id, 'refuse'))
  })
}
