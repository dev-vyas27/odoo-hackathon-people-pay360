/**
 * Placeholder for dashboard sections that have not been built yet.
 *
 * A catch-all route has the lowest matching priority in the App Router, so the
 * moment someone adds `app/(dashboard)/employees/page.tsx` this stops rendering
 * for `/employees` — with no coordination and no file for anyone to delete.
 *
 * That property is the point. The obvious alternative, dropping a stub
 * `page.tsx` into each section folder, puts one of my files inside Dev B's and
 * Dev C's route trees, and every one of them becomes a merge conflict the day
 * they build the real screen. This is a single file that I own and that quietly
 * gets out of the way.
 *
 * Delete it once every section is real.
 */
import Link from 'next/link'
import { LuArrowLeft, LuHardHat } from 'react-icons/lu'
import { getActor } from '@/lib/auth'
import { NAV_ITEMS, landingPathFor } from '@/components/layout/nav-items'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'

/** Who is building what, straight from docs/plans/. */
const OWNERS: Record<string, { owner: string; plan: string; modules: string }> = {
  employees: { owner: 'Dev B', plan: 'DEV-B-hr-operations.md', modules: 'people' },
  contracts: { owner: 'Dev B', plan: 'DEV-B-hr-operations.md', modules: 'employment' },
  schedules: { owner: 'Dev B', plan: 'DEV-B-hr-operations.md', modules: 'employment' },
  attendance: { owner: 'Dev B', plan: 'DEV-B-hr-operations.md', modules: 'attendance' },
  'time-off': { owner: 'Dev A', plan: 'DEV-A-platform.md', modules: 'timeoff' },
  payroll: {
    owner: 'Dev C',
    plan: 'DEV-C-payroll.md',
    modules: 'payroll-config, payroll-processing',
  },
  reports: { owner: 'Dev A', plan: 'DEV-A-platform.md', modules: 'analytics' },
  admin: { owner: 'Dev A', plan: 'DEV-A-platform.md', modules: 'identity' },
}

export default async function SectionPlaceholder({
  params,
}: {
  params: Promise<{ section: string[] }>
}) {
  // Next 16: params is a promise. Awaiting is mandatory, not stylistic.
  const { section } = await params
  const actor = await getActor()

  const [root] = section
  const known = NAV_ITEMS.find((item) => item.href === `/${root}`)
  const info = OWNERS[root]
  const title = known?.label ?? toTitle(root)

  return (
    <div>
      <PageHeader
        title={title}
        description={`/${section.join('/')}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={actor ? landingPathFor(actor.role) : '/login'}>
              <LuArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <LuHardHat className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">
          This screen has not been built yet.
        </p>

        {info ? (
          <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 text-left text-sm">
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{info.owner}</dd>
            <dt className="text-muted-foreground">Module</dt>
            <dd className="font-mono text-xs">{info.modules}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-mono text-xs">docs/plans/{info.plan}</dd>
          </dl>
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">
          Your session, the navigation and the permission checks around it are live —
          only the contents of this section are pending.
        </p>
      </div>
    </div>
  )
}

function toTitle(segment = ''): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Section'
}
