'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { SALARY_CATEGORIES, SALARY_CATEGORY_LABELS, type SalaryCategory } from '@/modules/payroll-config'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar } from '@/components/resource/filter-bar'
import { useCan } from '@/components/auth/current-user'
import { Button } from '@/components/ui/button'

export interface RuleRow {
  id: string
  name: string
  code: string
  category: string
  sequence: number
  computation: string
  active: boolean
}

const CATEGORY_OPTIONS = SALARY_CATEGORIES.map((cat) => ({
  value: cat,
  label: SALARY_CATEGORY_LABELS[cat] ?? cat,
}))

const columns: ColumnDef<RuleRow, unknown>[] = [
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
    accessorKey: 'computation',
    header: 'Computation',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.computation}</span>,
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.active ? 'active' : 'archived'} />,
  },
]

export function RulesTable({ rules }: { rules: RuleRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const search = (searchParams.get('search') ?? '').toLowerCase()
  const category = searchParams.get('category')

  const filteredRules = rules.filter((item) => {
    if (category && item.category !== category) return false
    if (search) {
      const matchName = item.name.toLowerCase().includes(search)
      const matchCode = item.code.toLowerCase().includes(search)
      if (!matchName && !matchCode) return false
    }
    return true
  })

  // hr_payroll_user reads salary configuration but cannot add to it.
  const canCreate = useCan('salary_rule', 'create')

  return (
    <div>
      <FilterBar
        searchPlaceholder="Search rules..."
        filters={[{ name: 'category', label: 'Category', options: CATEGORY_OPTIONS }]}
      />

      <ResourceTable
        data={filteredRules}
        columns={columns}
        onRowClick={(row) => router.push(`/payroll/rules/${row.id}`)}
        emptyMessage={
          rules.length === 0
            ? 'No salary rules yet. Add BASIC, HRA and NET to get a payslip computing.'
            : 'No salary rules match these filters.'
        }
        emptyAction={
          rules.length === 0 && canCreate ? (
            <Button asChild variant="outline">
              <Link href="/payroll/rules/new">Create the first rule</Link>
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

