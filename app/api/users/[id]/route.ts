


import { getAccount, updateAccount } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await getAccount(await requireActor(), id))
  })
}

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params
    return respond(await updateAccount(await requireActor(), id, await request.json()))
  })
}
