


import { runSeed } from '@/scripts/seed/run'
import { isDemoSeedEnabled } from '@/lib/demo-mode'
import { handle } from '@/lib/http'


export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isDemoSeedEnabled()) return notFound()

  return handle(async () => {
    


    const body = await request.json().catch(() => ({}))
    const reset = body?.reset === true

    const logs: string[] = []
    const summary = await runSeed({ reset, onLog: (message) => logs.push(message) })

    console.log(`[demo-seed] seeded ${summary.parts.length} parts in ${summary.durationMs}ms`)

    return Response.json({ data: { ...summary, logs } })
  })
}

function notFound(): Response {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'Not found' } },
    { status: 404 },
  )
}
