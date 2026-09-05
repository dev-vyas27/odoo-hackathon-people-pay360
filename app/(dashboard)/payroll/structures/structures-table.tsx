'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { SalaryStructureListItem } from '@/modules/payroll-config'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { Button } from '@/components/ui/button'

const columns: ColumnDef<SalaryStructureListItem, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.code}</span>,
  },
  {
    accessorKey: 'ruleCount',
    header: 'Rules',
    cell: ({ row }) => <span className="tabular-nums">{row.original.ruleCount}</span>,
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.active ? 'active' : 'archived'} />,
  },
]

export function StructuresTable({ structures }: { structures: SalaryStructureListItem[] }) {
  const router = useRouter()

  return (
    <ResourceTable
      data={structures}
      columns={columns}
      onRowClick={(row) => router.push(`/payroll/structures/${row.id}`)}
      emptyMessage="No salary structures yet. A payrun needs one before it can compute."
      emptyAction={
        <Button asChild variant="outline">
          <Link href="/payroll/structures/new">Create the first structure</Link>
        </Button>
      }
    />
  )
}
