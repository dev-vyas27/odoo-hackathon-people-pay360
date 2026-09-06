'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { PAYRUN_STATUSES, PAYRUN_STATUS_LABELS, type PayrunView } from '@/modules/payroll-processing'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar } from '@/components/resource/filter-bar'
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

export function PayrunsTable({ payruns }: { payruns: PayrunView[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const search = (searchParams.get('search') ?? '').toLowerCase()
  const status = searchParams.get('status')

  const filteredPayruns = payruns.filter((item) => {
    if (status && item.status !== status) return false
    if (search) {
      const matchName = item.name.toLowerCase().includes(search)
      const matchStructure = item.structureName.toLowerCase().includes(search)
      if (!matchName && !matchStructure) return false
    }
    return true
  })

  return (
    <div>
      <FilterBar
        searchPlaceholder="Search pay runs..."
        filters={[{ name: 'status', label: 'Status', options: STATUS_OPTIONS }]}
      />

      <ResourceTable
        data={filteredPayruns}
        columns={columns}
        onRowClick={(row) => router.push(`/payroll/payruns/${row.id}`)}
        emptyMessage={payruns.length === 0 ? 'No pay runs yet.' : 'No pay runs match these filters'}
        emptyAction={
          payruns.length === 0 ? (
            <Button asChild variant="outline">
              <Link href="/payroll/payruns/new">Create the first pay run</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

