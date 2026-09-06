/**
 * GET /api/attendance/today — the signed-in employee's clock state.
 *
 * Scoped to the CALLER, always. There is deliberately no `employeeId`
 * parameter: this endpoint exists for the self-service widget, and letting it
 * take an id would turn a personal view into a way to watch a colleague's
 * comings and goings.
 *
 * Never cached. The whole value is that it is true right now.
 */
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
