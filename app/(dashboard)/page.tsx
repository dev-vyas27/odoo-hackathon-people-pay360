


import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { landingPathFor } from '@/components/layout/nav-items'

export default async function HomePage() {
  const actor = await getActor()
  redirect(actor ? landingPathFor(actor.role) : '/login')
}
