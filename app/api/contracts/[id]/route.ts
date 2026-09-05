import type { NextRequest } from 'next/server'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { updateContractSchema, getContract, updateContract, deleteContract } from '@/modules/employment'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await params
    return respond(await getContract(actor, id))
  })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await params
    const body = updateContractSchema.parse(await req.json())
    return respond(await updateContract(actor, id, body))
  })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    const actor = await requireActor()
    const { id } = await params
    return respond(await deleteContract(actor, id), 204)
  })
}
