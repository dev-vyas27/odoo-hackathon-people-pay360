import type { NextRequest } from 'next/server'
import { requireActor } from '@/lib/auth'
import { handle, respond, parsePageQuery } from '@/lib/http'
import { createContractSchema, listContracts, createContract } from '@/modules/employment'

export async function GET(req: NextRequest) {
  return handle(async () => {
    const actor = await requireActor()
    


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
