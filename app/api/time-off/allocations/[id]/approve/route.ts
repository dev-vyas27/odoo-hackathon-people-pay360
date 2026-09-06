/**
 * POST /api/time-off/allocations/[id]/approve — make the balance spendable.
 */
import { decideAllocation } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await decideAllocation(await requireActor(), id, 'approve'))
  })
}
