/**
 * GET    /api/attendance/[id]  — fetch one record (row-scoped for employees).
 * PATCH  /api/attendance/[id]  — authorized correction; always flags `manual`.
 * DELETE /api/attendance/[id]  — authorized users only.
 */
import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import {
  correctAttendanceSchema,
  createCorrectAttendanceUseCase,
  createDeleteAttendanceUseCase,
  createGetAttendanceUseCase,
} from '@/modules/attendance'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  return handle(async () => {
    const { id } = await params
    const actor = await requireActor()
    const result = await createGetAttendanceUseCase().execute({ actor, attendanceId: id })
    return respond(result)
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  return handle(async () => {
    const { id } = await params
    const actor = await requireActor()
    const body = correctAttendanceSchema.parse(await request.json())
    const result = await createCorrectAttendanceUseCase().execute({ actor, attendanceId: id, ...body })
    return respond(result)
  })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  return handle(async () => {
    const { id } = await params
    const actor = await requireActor()
    const result = await createDeleteAttendanceUseCase().execute({ actor, attendanceId: id })
    return respond(result, 204)
  })
}
