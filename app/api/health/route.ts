/**
 * Liveness + database reachability.
 *
 * First thing to hit when something looks broken: it separates "the app is
 * down" from "Mongo is unreachable", which are very different 3am problems.
 */
import { connectDB } from '@/lib/db'
import { handle } from '@/lib/http'

export async function GET() {
  return handle(async () => {
    let database: 'up' | 'down' = 'down'
    let detail: string | undefined

    try {
      const conn = await connectDB()
      database = conn.connection.readyState === 1 ? 'up' : 'down'
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
