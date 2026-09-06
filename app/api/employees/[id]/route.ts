import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { archiveEmployee, getEmployeeDetail, updateEmployee } from '@/modules/people'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await getEmployeeDetail(actor, id))
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await updateEmployee(actor, id, await request.json()))
  })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await context.params
    return respond(await archiveEmployee(actor, id))
  })
}
