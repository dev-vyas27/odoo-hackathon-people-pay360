


import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { Ok } from '@/modules/shared'
import { checkOutSchema, createCheckOutUseCase, toAttendanceView } from '@/modules/attendance'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  return handle(async () => {
    const { id } = await params
    const actor = await requireActor()
    const body = checkOutSchema.parse(await request.json())
    const result = await createCheckOutUseCase().execute({ actor, attendanceId: id, ...body })
    if (!result.ok) return respond(result)
    return respond(Ok(toAttendanceView(result.value.attendance, result.value.status)))
  })
}
