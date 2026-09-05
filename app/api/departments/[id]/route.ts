import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { deleteDepartment, getDepartment, updateDepartment } from '@/modules/people'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await getDepartment(actor, id))
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await updateDepartment(actor, id, await request.json()))
  })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await deleteDepartment(actor, id), 204)
  })
}
