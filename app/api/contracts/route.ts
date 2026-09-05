import type { NextRequest } from 'next/server'
import { connectDB } from '@/lib/db'
import { requireActor } from '@/lib/auth'
import { handle, respond, parseQuery } from '@/lib/http'
import { pageQuerySchema } from '@/modules/shared'
import { createContractSchema, listContracts, createContract } from '@/modules/employment'

export async function GET(req: NextRequest) {
  return handle(async () => {
    await connectDB()
    const actor = await requireActor()
    const query = pageQuerySchema.parse(parseQuery(req.url))
    return respond(await listContracts(actor, query))
  })
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await connectDB()
    const actor = await requireActor()
    const body = createContractSchema.parse(await req.json())
    return respond(await createContract(actor, body), 201)
  })
}
