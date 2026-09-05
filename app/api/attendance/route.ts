/**
 * GET  /api/attendance       — paged list, filterable by employee/date range/status.
 * POST /api/attendance       — check an employee in (creates a new open record).
 */
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'
import { Ok } from '@/modules/shared'
import type { AttendanceListItem } from '@/modules/attendance/schemas'
import { checkInSchema, createCheckInUseCase, createListAttendanceUseCase, listAttendanceQuerySchema } from '@/modules/attendance'

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    const query = listAttendanceQuerySchema.parse(parseQuery(request.url))
    const result = await createListAttendanceUseCase().execute({
      actor,
      filter: { employeeId: query.employeeId, from: query.from, to: query.to, status: query.status },
      page: { page: query.page, limit: query.limit, sort: query.sort, order: query.order, search: query.search },
    })
    if (!result.ok) return respond(result)

    /**
     * Map to the AttendanceListItem DTO the screen is typed against.
     *
     * Returning the aggregate directly published `workedHours` and `status` as
     * undefined, and the list page died on `status.replace(...)` inside
     * StatusBadge. The domain object is not a wire format: the boundary is
     * where it becomes one.
     */
    return respond(
      Ok({
        ...result.value,
        items: result.value.items.map(({ attendance, status }): AttendanceListItem => {
          const props = attendance.toProps()
          return {
            id: props.id,
            employeeId: props.employeeId,
            checkIn: props.checkIn.toISOString(),
            checkOut: props.checkOut ? props.checkOut.toISOString() : null,
            breakMinutes: props.breakMinutes,
            workedHours: attendance.workedHoursOrNull(),
            status,
            manual: props.manual,
          }
        }),
      }),
    )
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    const body = checkInSchema.parse(await request.json())
    const result = await createCheckInUseCase().execute({ actor, ...body })
    return respond(result, 201)
  })
}
