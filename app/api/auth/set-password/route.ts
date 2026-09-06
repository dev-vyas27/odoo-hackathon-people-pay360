


import { checkSetupLink, setPassword } from '@/modules/identity'
import { handle, parseQuery, respond } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(async () =>
    respond(await checkSetupLink(parseQuery(request.url).token ?? '')),
  )
}

export async function POST(request: Request) {
  return handle(async () => respond(await setPassword(await request.json())))
}
