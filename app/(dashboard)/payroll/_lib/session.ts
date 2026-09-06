/**
 * Session for payroll SERVER components.
 *
 * Pages read through use cases directly rather than fetching their own API:
 * one process, no HTTP hop, no cookie forwarding. The use case still runs its
 * own `authorize()`, so this only establishes who is asking.
 *
 * `proxy.ts` has already rejected anonymous requests by the time a page renders;
 * the redirect here is the belt to that braces.
 */
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import type { Actor } from '@/modules/shared'

export async function pageActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) redirect('/login')
  return actor
}

/**
 * Run a page's data load, turning an infrastructure failure into something the
 * page can render.
 *
 * Without this a missing DATABASE_URL or an unimplemented Dev B port produces a
 * Next error overlay instead of a screen — and during integration those ports
 * throw by design.
 */
export async function load<T>(fn: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; message: string }
> {
  try {
    return { ok: true, data: await fn() }
  } catch (reason) {
    console.error('[payroll] page load failed:', reason)
    return {
      ok: false,
      message: reason instanceof Error ? reason.message : 'Something went wrong loading this page.',
    }
  }
}
