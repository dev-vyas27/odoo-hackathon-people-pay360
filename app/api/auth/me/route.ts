


import { me } from '@/modules/identity'
import { getActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function GET() {
  return handle(async () => respond(me(await getActor())))
}
