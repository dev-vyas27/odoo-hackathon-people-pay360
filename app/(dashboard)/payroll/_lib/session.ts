


import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import type { Actor } from '@/modules/shared'

export async function pageActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) redirect('/login')
  return actor
}



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
