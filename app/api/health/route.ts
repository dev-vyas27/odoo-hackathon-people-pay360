


import { ping } from '@/lib/db'
import { handle } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    let database: 'up' | 'down' = 'down'
    let detail: string | undefined

    try {
      database = (await ping()) ? 'up' : 'down'
    } catch (reason) {
      detail = reason instanceof Error ? reason.message : String(reason)
    }

    return Response.json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      detail,
      time: new Date().toISOString(),
    })
  })
}
