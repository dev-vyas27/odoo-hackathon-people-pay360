'use client'

/**
 * The Allocation List.
 *
 * Spec A4: "Allocations manage employee balances, requiring approval before
 * availability, and tracking detailed metrics like taken, remaining, and
 * validity periods." All four are columns here — and `remaining` comes from the
 * aggregate, so the number on screen is the number the approval check uses.
 *
 * Approve / refuse live on the row rather than on a detail page: an allocation
 * has no workflow beyond that one decision, and a form to hold two buttons
 * would be ceremony.
 */
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { LuCheck, LuPlus, LuX } from 'react-icons/lu'
import type { AllocationListItem } from '@/modules/timeoff/schemas'
import { ALLOCATION_STATUS_OPTIONS } from '../_components/options'
import { useResourceAction, useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { useConfirm } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/auth/current-user'
import { formatDateRange, formatDuration } from '../_components/format'

const RESOURCE = 'time-off/allocations'

export default function AllocationsPage() {
  // An employee may SEE their allocations but not grant one.
  const canCreate = useCan('allocation', 'create')
  const params = useFilterParams(['status', 'timeOffTypeId'])
  const { page, isLoading } = useResourceList<AllocationListItem>(RESOURCE, params)

  const approve = useResourceAction(RESOURCE, 'approve', {
    successMessage: 'Allocation approved and now available',
  })
  const refuse = useResourceAction(RESOURCE, 'refuse', { successMessage: 'Allocation refused' })
  const { confirm, dialog } = useConfirm()

  const columns: ColumnDef<AllocationListItem, unknown>[] = [
    {
      accessorKey: 'employeeName',
      header: 'Employee',
      cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
    },
    { accessorKey: 'timeOffTypeName', header: 'Type' },
    {
      accessorKey: 'allocated',
      header: 'Allocated',
      cell: ({ row }) => (
        <span className="tabular">
          {formatDuration(row.original.allocated, row.original.unit)}
        </span>
      ),
    },
    {
      accessorKey: 'taken',
      header: 'Taken',
      cell: ({ row }) => <span className="tabular">{row.original.taken}</span>,
    },
    {
      accessorKey: 'remaining',
      header: 'Remaining',
      cell: ({ row }) => (
        <span
          className={row.original.remaining <= 0 ? 'tabular text-muted-foreground' : 'tabular'}
        >
          {row.original.remaining}
        </span>
      ),
    },
    {
      id: 'validity',
      header: 'Validity',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {formatDateRange(row.original.validFrom, row.original.validTo)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        // Only a pending allocation has a decision left to make.
        if (row.original.status !== 'to_approve' && row.original.status !== 'draft') return null
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Approve allocation"
              onClick={(event) => {
                event.stopPropagation()
                confirm({
                  title: 'Approve this allocation?',
                  description: `${row.original.employeeName} will be able to spend ${formatDuration(row.original.allocated, row.original.unit)} of ${row.original.timeOffTypeName}.`,
                  confirmLabel: 'Approve',
                  onConfirm: () => approve.mutateAsync({ id: row.original.id }),
                })
              }}
            >
              <LuCheck className="text-success" aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Refuse allocation"
              onClick={(event) => {
                event.stopPropagation()
                confirm({
                  title: 'Refuse this allocation?',
                  description: 'It will not be available to spend. Only possible while nothing has been taken against it.',
                  confirmLabel: 'Refuse',
                  destructive: true,
                  onConfirm: () => refuse.mutateAsync({ id: row.original.id }),
                })
              }}
            >
              <LuX className="text-destructive" aria-hidden />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Allocations"
        description="Entitlements are not spendable until they are approved. Approved leave draws down from the matching allocation."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/time-off/allocations/new">
                <LuPlus aria-hidden />
                New allocation
              </Link>
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchPlaceholder="Search allocations..."
        filters={[{ name: 'status', label: 'Status', options: ALLOCATION_STATUS_OPTIONS }]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No allocations yet"
        emptyAction={
          canCreate ? (
            <Button variant="outline" asChild>
              <Link href="/time-off/allocations/new">Grant the first one</Link>
            </Button>
          ) : undefined
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
      {dialog}
    </div>
  )
}
