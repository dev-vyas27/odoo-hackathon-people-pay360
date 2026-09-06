


import { createAccount, listAccounts } from '@/modules/identity'
import { requireActor } from '@/lib/auth'
import { appOrigin } from '@/lib/app-url'
import { handle, parsePageQuery, respond } from '@/lib/http'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await listAccounts(await requireActor(), parsePageQuery(request.url))),
  )
}

export async function POST(request: Request) {
  return handle(async () =>
    respond(
      await createAccount(await requireActor(), await request.json(), appOrigin(request)),
      201,
    ),
  )
}
