/**
 * POST /api/demo/seed — fill the database with demo data.
 *
 * Unauthenticated by necessity: its whole job is to create the accounts you
 * would otherwise need in order to sign in. That makes the `DEMO_SEED_ENABLED`
 * flag the only thing standing between this route and anyone on the internet,
 * so it is checked first, before the request body is even looked at.
 *
 * When the flag is off the response is **404, not 403**. A 403 confirms the
 * endpoint exists and invites someone to go hunting for a way to enable it;
 * a 404 is indistinguishable from a route that was never deployed.
 *
 * GET is not implemented on purpose. A seed must not be triggerable by
 * following a link, a prefetch, or an <img src> on a page in another tab.
 */
import { runSeed } from '@/scripts/seed/run'
import { isDemoSeedEnabled } from '@/lib/demo-mode'
import { handle } from '@/lib/http'

/** Seeding writes to the database; there is nothing here to prerender. */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isDemoSeedEnabled()) return notFound()

  return handle(async () => {
    /**
     * `reset` clears the seeded collections first. It has to be asked for
     * explicitly in the body — a destructive default is how someone loses data
     * by clicking a button labelled "load".
     */
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
