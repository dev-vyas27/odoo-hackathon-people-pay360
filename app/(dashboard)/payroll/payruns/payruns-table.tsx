'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { PAYRUN_STATUSES, PAYRUN_STATUS_LABELS, type PayrunView } from '@/modules/payroll-processing'
import { useResourceList } from '@/hooks/use-resource'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { formatPeriod } from '../_lib/format'

const STATUS_OPTIONS = PAYRUN_STATUSES.map((status) => ({
  value: status,
  label: PAYRUN_STATUS_LABELS[status] ?? status.replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const columns: ColumnDef<PayrunView, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Pay run',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'structureName',
    header: 'Structure',
    cell: ({ row }) => <span className="text-foreground">{row.original.structureName}</span>,
  },
  {
    accessorKey: 'periodStart',
    header: 'Period',
    
    
    meta: { sortKey: 'period_start' },
    cell: ({ row }) => (
      <span className="tabular">
        {formatPeriod(row.original.periodStart, row.original.periodEnd)}
      </span>
    ),
  },
  {
    accessorKey: 'employeeCount',
    header: 'Employees',
    cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.employeeCount}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function PayrunsTable() {
  const router = useRouter()
  const params = useFilterParams(['status'])
  const { page, isLoading } = useResourceList<PayrunView>('payruns', params)

  return (
    <div>
      <FilterBar
        searchPlaceholder="Search pay runs..."
        filters={[{ name: 'status', label: 'Status', options: STATUS_OPTIONS }]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/payroll/payruns/${row.id}`)}
        emptyMessage="No pay runs match these filters"
        emptyAction={
          <Button asChild variant="outline">
            <Link href="/payroll/payruns/new">Create the first pay run</Link>
          </Button>
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
