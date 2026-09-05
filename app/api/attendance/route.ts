/**
 * GET  /api/attendance       — paged list, filterable by employee/date range/status.
 * POST /api/attendance       — check an employee in (creates a new open record).
 */
import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'
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
    return respond(result)
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
