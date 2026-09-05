'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { SALARY_CATEGORY_LABELS, type SalaryCategory } from '@/modules/payroll-config'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
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

/**
 * Sequence is the first column on purpose: it is the order the rules actually
 * run in, and reading the list top to bottom should read like a payslip.
 */
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
  { accessorKey: 'name', header: 'Name' },
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

  return (
    <ResourceTable
      data={rules}
      columns={columns}
      onRowClick={(row) => router.push(`/payroll/rules/${row.id}`)}
      emptyMessage="No salary rules yet. Add BASIC, HRA and NET to get a payslip computing."
      emptyAction={
        <Button asChild variant="outline">
          <Link href="/payroll/rules/new">Create the first rule</Link>
        </Button>
      }
    />
  )
}
