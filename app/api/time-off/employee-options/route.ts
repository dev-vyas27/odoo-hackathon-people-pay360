


import { listEmployeeOptions } from '@/modules/timeoff'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'

export async function GET() {
  return handle(async () => respond(await listEmployeeOptions(await requireActor())))
}
