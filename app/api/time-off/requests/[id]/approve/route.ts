/**
 * POST /api/time-off/requests/[id]/approve
 *
 * Approving deducts the allocation in the same transaction — see
 * approve-leave.use-case.ts. This file only decides who is asking.
 */
import { approveLeave } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await approveLeave(await requireActor(), id))
  })
}
