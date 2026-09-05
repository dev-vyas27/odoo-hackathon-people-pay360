/**
 * The Time Off shell.
 *
 * Spec A4: Time Off "houses Requests, Allocations, and configured Time Off
 * Types". Those are the three tabs, and they are the whole section.
 *
 * Tabs are filtered by permission on the server, exactly as the top nav is, so
 * a role that cannot configure leave types never sees the tab rather than
 * seeing it and bouncing off /forbidden.
 */
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

  // Only roles that may configure policy see the configuration tab.
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
