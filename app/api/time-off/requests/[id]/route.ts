


import { deleteLeave, getLeaveRequest } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await getLeaveRequest(await requireActor(), id))
  })
}

export async function DELETE(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await deleteLeave(await requireActor(), id), 204)
  })
}
