/**
 * PATCH  /api/time-off/types/[id]
 * DELETE /api/time-off/types/[id] — refused when the type has history.
 */
import { deleteTimeOffType, updateTimeOffType } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await updateTimeOffType(await requireActor(), id, await request.json()))
  })
}

export async function DELETE(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await deleteTimeOffType(await requireActor(), id), 204)
  })
}
