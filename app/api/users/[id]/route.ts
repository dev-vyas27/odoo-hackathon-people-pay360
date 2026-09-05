/**
 * GET   /api/users/[id] — one account
 * PATCH /api/users/[id] — rename, change role, activate/deactivate, reset password
 *
 * Admin only; the check is inside the use case, along with the rules that stop
 * an administrator locking themselves out.
 */
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
