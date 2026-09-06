


import { requireActor } from '@/lib/auth'
import { handle, parseQuery, respond } from '@/lib/http'
import { Ok } from '@/modules/shared'
import {
  checkInSchema,
  createCheckInUseCase,
  createListAttendanceUseCase,
  listAttendanceQuerySchema,
  toAttendanceView,
} from '@/modules/attendance'

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

    


    return respond(
      Ok({
        ...result.value,
        items: result.value.items.map(({ attendance, status }) =>
          toAttendanceView(attendance, status),
        ),
      }),
    )
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    const body = checkInSchema.parse(await request.json())
    const result = await createCheckInUseCase().execute({ actor, ...body })
    if (!result.ok) return respond(result)
    return respond(Ok(toAttendanceView(result.value.attendance, result.value.status)), 201)
  })
}
