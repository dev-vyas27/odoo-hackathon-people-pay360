'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu'
import Link from 'next/link'
import { LEAVE_STATUSES } from '@/modules/shared'
import type { LeaveRequestListItem, TimeOffTypeView } from '@/modules/timeoff/schemas'
import { useDeleteResource, useResourceList } from '@/hooks/use-resource'
import { useCan } from '@/components/auth/current-user'
import { useConfirm } from '@/components/resource/confirm-dialog'
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

const isPending = (status: LeaveRequestListItem['status']) =>
  status === 'to_approve' || status === 'draft'

const BASE_COLUMNS: ColumnDef<LeaveRequestListItem, unknown>[] = [
  {
    accessorKey: 'employeeName',
    header: 'Employee',
    cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
  },
  { accessorKey: 'timeOffTypeName', header: 'Type' },
  {
    id: 'dates',
    header: 'Dates',
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

  const canEdit = useCan('leave_request', 'update')
  const canDelete = useCan('leave_request', 'delete')
  const withdraw = useDeleteResource('time-off/requests', {
    successMessage: 'Request withdrawn',
  })
  const { confirm, dialog } = useConfirm()

  const columns: ColumnDef<LeaveRequestListItem, unknown>[] =
    canEdit || canDelete
      ? [
          ...BASE_COLUMNS,
          {
            id: 'actions',
            header: '',
            enableSorting: false,
            cell: ({ row }) => {
              if (!isPending(row.original.status)) return null
              const request = row.original

              return (
                <div className="flex items-center justify-end gap-1">
                  {canEdit ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${request.timeOffTypeName} request`}
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/time-off/requests/${request.id}/edit`)
                      }}
                    >
                      <LuPencil aria-hidden />
                    </Button>
                  ) : null}

                  {canDelete ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Withdraw ${request.timeOffTypeName} request`}
                      onClick={(event) => {
                        event.stopPropagation()
                        confirm({
                          title: 'Withdraw this request?',
                          description:
                            'It is removed entirely and nobody is asked to decide on it. Raise a new request if you change your mind.',
                          confirmLabel: 'Withdraw',
                          destructive: true,
                          onConfirm: () => withdraw.mutateAsync(request.id),
                        })
                      }}
                    >
                      <LuTrash2 className="text-destructive" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              )
            },
          },
        ]
      : BASE_COLUMNS

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
      {dialog}
    </div>
  )
}
