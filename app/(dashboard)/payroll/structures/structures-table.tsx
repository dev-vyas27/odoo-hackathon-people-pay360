'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import type { SalaryStructureListItem } from '@/modules/payroll-config'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar } from '@/components/resource/filter-bar'
import { Button } from '@/components/ui/button'

const ACTIVE_OPTIONS = [
  { label: 'Active', value: 'true' },
  { label: 'Archived', value: 'false' },
]

const columns: ColumnDef<SalaryStructureListItem, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.code}</span>,
  },
  {
    accessorKey: 'ruleCount',
    header: 'Rules',
    cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.ruleCount}</span>,
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.active ? 'active' : 'archived'} />,
  },
]

export function StructuresTable({ structures }: { structures: SalaryStructureListItem[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const search = (searchParams.get('search') ?? '').toLowerCase()
  const activeParam = searchParams.get('active')

  const filteredStructures = structures.filter((item) => {
    if (activeParam === 'true' && !item.active) return false
    if (activeParam === 'false' && item.active) return false
    if (search) {
      const matchName = item.name.toLowerCase().includes(search)
      const matchCode = item.code.toLowerCase().includes(search)
      if (!matchName && !matchCode) return false
    }
    return true
  })

  return (
    <div>
      <FilterBar
        searchPlaceholder="Search structures..."
        filters={[{ name: 'active', label: 'Status', options: ACTIVE_OPTIONS }]}
      />

      <ResourceTable
        data={filteredStructures}
        columns={columns}
        onRowClick={(row) => router.push(`/payroll/structures/${row.id}`)}
        emptyMessage={
          structures.length === 0
            ? 'No salary structures yet. A payrun needs one before it can compute.'
            : 'No salary structures match these filters.'
        }
        emptyAction={
          structures.length === 0 ? (
            <Button asChild variant="outline">
              <Link href="/payroll/structures/new">Create the first structure</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

