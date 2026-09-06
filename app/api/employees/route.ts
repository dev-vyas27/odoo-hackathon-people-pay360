import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'
import { createEmployee, listEmployees } from '@/modules/people'

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    return respond(await listEmployees(actor, parseQuery(request.url)))
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    return respond(await createEmployee(actor, await request.json()), 201)
  })
}
