import type { NextRequest } from 'next/server'
import { connectDB } from '@/lib/db'
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { updateScheduleSchema, getSchedule, updateSchedule, deleteSchedule } from '@/modules/employment'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    await connectDB()
    const actor = await requireActor()
    const { id } = await params
    return respond(await getSchedule(actor, id))
  })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    await connectDB()
    const actor = await requireActor()
    const { id } = await params
    const body = updateScheduleSchema.parse(await req.json())
    return respond(await updateSchedule(actor, id, body))
  })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  return handle(async () => {
    await connectDB()
    const actor = await requireActor()
    const { id } = await params
    return respond(await deleteSchedule(actor, id), 204)
  })
}
