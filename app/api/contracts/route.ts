import type { NextRequest } from 'next/server'
import { requireActor } from '@/lib/auth'
import { handle, respond, parsePageQuery } from '@/lib/http'
import { createContractSchema, listContracts, createContract } from '@/modules/employment'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const actor = await requireActor()
    /**
     * `parsePageQuery`, not `pageQuerySchema.parse(parseQuery(...))`.
     *
     * The schema only describes paging keys, so parsing with it DROPS every
     * other query parameter — `?employeeId=…` silently returned the whole
     * table. parsePageQuery keeps the non-paging keys as `filters`, which is
     * what BaseSqlRepository.buildWhere turns into a parameterised WHERE.
     */
    return respond(await listContracts(actor, parsePageQuery(req.url)))
  })
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const actor = await requireActor()
    const body = createContractSchema.parse(await req.json())
    return respond(await createContract(actor, body), 201)
  })
}
