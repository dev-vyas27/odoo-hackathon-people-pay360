


import { getActor } from '@/lib/auth'
import { can } from '@/modules/shared'
import { TimeOffTabs, type TimeOffTab } from './_components/time-off-tabs'

export default async function TimeOffLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor) return null

  const tabs: TimeOffTab[] = [
    { href: '/time-off/requests', label: 'Requests' },
    { href: '/time-off/allocations', label: 'Allocations' },
  ]

  
  if (can(actor.role, 'time_off_type', 'update')) {
    tabs.push({ href: '/time-off/types', label: 'Types' })
  }

  return (
    <div>
      <TimeOffTabs tabs={tabs} />
      {children}
    </div>
  )
}
