'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import type { SalaryRule } from '@/modules/payroll-config'
import {
  SALARY_CATEGORIES,
  SALARY_CATEGORY_LABELS,
  type SalaryCategory,
} from '@/modules/payroll-config'
import { useResourceList } from '@/hooks/use-resource'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { useCan } from '@/components/auth/current-user'
import { Button } from '@/components/ui/button'

const CATEGORY_OPTIONS = SALARY_CATEGORIES.map((cat) => ({
  value: cat,
  label: SALARY_CATEGORY_LABELS[cat] ?? cat,
}))

function describe(computation: SalaryRule['computation']): string {
  switch (computation.type) {
    case 'percentage':
      return `${computation.percent}% of ${computation.ofCode}`
    case 'formula':
      return computation.expression
    default:
      return `Fixed ${computation.amount}`
  }
}

const columns: ColumnDef<SalaryRule, unknown>[] = [
  {
    accessorKey: 'sequence',
    header: 'Seq',
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.sequence}</span>,
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <span className="font-mono text-xs tracking-tight text-foreground">{row.original.code}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => SALARY_CATEGORY_LABELS[row.original.category as SalaryCategory] ?? row.original.category,
  },
  {
    id: 'computation',
    header: 'Computation',
    cell: ({ row }) => <span className="text-muted-foreground">{describe(row.original.computation)}</span>,
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.active ? 'active' : 'archived'} />,
  },
]

export function RulesTable() {
  const router = useRouter()
  const params = useFilterParams(['category'])
  const { page, isLoading } = useResourceList<SalaryRule>('payroll/rules', params)

  
  const canCreate = useCan('salary_rule', 'create')

  return (
    <div>
      <FilterBar
        searchPlaceholder="Search rules..."
        filters={[{ name: 'category', label: 'Category', options: CATEGORY_OPTIONS }]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/payroll/rules/${row.id}`)}
        emptyMessage="No salary rules match these filters."
        emptyAction={
          canCreate ? (
            <Button asChild variant="outline">
              <Link href="/payroll/rules/new">Create the first rule</Link>
            </Button>
          ) : undefined
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
