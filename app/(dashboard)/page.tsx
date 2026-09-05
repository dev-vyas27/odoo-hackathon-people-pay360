/**
 * `/` — send each role somewhere it is actually allowed to be.
 *
 * A fixed redirect to `/reports` would bounce a plain employee straight into
 * /forbidden on their first click, so the destination is derived from the same
 * permission table the nav uses.
 */
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { landingPathFor } from '@/components/layout/nav-items'

export default async function HomePage() {
  const actor = await getActor()
  redirect(actor ? landingPathFor(actor.role) : '/login')
}
