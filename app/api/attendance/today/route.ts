


import { requireActor } from '@/lib/auth'
import { handle, respond } from '@/lib/http'
import { createGetTodayAttendanceUseCase } from '@/modules/attendance'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const actor = await requireActor()
    return respond(
      await createGetTodayAttendanceUseCase().execute({
        actor,
        employeeId: actor.employeeId,
      }),
    )
  })
}
