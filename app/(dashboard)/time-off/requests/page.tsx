'use client'

/**
 * The Request List.
 *
 * Spec B4: "Request List provides an overview of Employee, Type, Dates,
 * Duration, and Status." Those five columns, in that order, are the whole
 * requirement — so they are the whole table.
 *
 * Everything else is the shared kernel doing its job: `FilterBar` writes to the
 * URL, `useResourceList` reads the same URL back, `ResourceTable` renders, and
 * `Pagination` pages. Building this screen is a column definition, which is the
 * entire point of having built the kernel first.
 */
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPlus } from 'react-icons/lu'
import Link from 'next/link'
import { LEAVE_STATUSES } from '@/modules/shared'
import type { LeaveRequestListItem, TimeOffTypeView } from '@/modules/timeoff/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { formatDateRange, formatDuration } from '../_components/format'

const STATUS_OPTIONS = LEAVE_STATUSES.map((status) => ({
  value: status,
  label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const columns: ColumnDef<LeaveRequestListItem, unknown>[] = [
  {
    accessorKey: 'employeeName',
    header: 'Employee',
    cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
  },
  { accessorKey: 'timeOffTypeName', header: 'Type' },
  {
    id: 'dates',
    header: 'Dates',
    // The cell shows a range, but a header can only sort by one real column —
    // `startsOn` is what the repository's allowlist accepts (see `orderBy` in
    // timeoff.repositories.ts), so that is what clicking this header toggles.
    meta: { sortKey: 'startsOn' },
    cell: ({ row }) => (
      <span className="tabular">{formatDateRange(row.original.start, row.original.end)}</span>
    ),
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="tabular">
        {formatDuration(row.original.duration, row.original.unit)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export default function LeaveRequestsPage() {
  const router = useRouter()
  const params = useFilterParams(['status', 'timeOffTypeId'])
  const { page, isLoading } = useResourceList<LeaveRequestListItem>('time-off/requests', params)

  /**
   * `timeOffTypeId` was already forwarded to the API by `useFilterParams`
   * above and already applied by the repository — there was simply no control
   * on screen that could ever set it. Types are few, so fetching all of them
   * for the filter's options is one small request, not a second paged list.
   */
  const types = useResourceList<TimeOffTypeView>('time-off/types', { limit: 100 })
  const typeOptions = types.page.items.map((t) => ({ value: t.id, label: t.name }))

  return (
    <div>
      <PageHeader
        title="Time Off Requests"
        description="Raise, review and decide on leave. Approving a request consumes the matching allocation."
        actions={
          <Button asChild>
            <Link href="/time-off/requests/new">
              <LuPlus aria-hidden />
              New request
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search requests..."
        filters={[
          { name: 'status', label: 'Status', options: STATUS_OPTIONS },
          { name: 'timeOffTypeId', label: 'Type', options: typeOptions },
        ]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/time-off/requests/${row.id}`)}
        emptyMessage="No leave requests match these filters"
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/time-off/requests/new">Raise the first one</Link>
          </Button>
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
