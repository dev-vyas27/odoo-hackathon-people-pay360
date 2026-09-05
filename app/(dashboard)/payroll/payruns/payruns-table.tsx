'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { PayrunView } from '@/modules/payroll-processing'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { Button } from '@/components/ui/button'
import { formatPeriod } from '../_lib/format'

const columns: ColumnDef<PayrunView, unknown>[] = [
  { accessorKey: 'name', header: 'Pay run' },
  { accessorKey: 'structureName', header: 'Structure' },
  {
    accessorKey: 'periodStart',
    header: 'Period',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatPeriod(row.original.periodStart, row.original.periodEnd)}
      </span>
    ),
  },
  {
    accessorKey: 'employeeCount',
    header: 'Employees',
    cell: ({ row }) => <span className="tabular-nums">{row.original.employeeCount}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

export function PayrunsTable({ payruns }: { payruns: PayrunView[] }) {
  const router = useRouter()

  return (
    <ResourceTable
      data={payruns}
      columns={columns}
      onRowClick={(row) => router.push(`/payroll/payruns/${row.id}`)}
      emptyMessage="No pay runs yet."
      emptyAction={
        <Button asChild variant="outline">
          <Link href="/payroll/payruns/new">Create the first pay run</Link>
        </Button>
      }
    />
  )
}
