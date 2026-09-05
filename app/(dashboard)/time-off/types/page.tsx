'use client'

/**
 * Time Off Types — the leave policy table.
 *
 * Spec A4: "Time Off Types define leave policies including units (days/hours),
 * allocation requirements, approval workflows, and payroll integration."
 *
 * Three of those four are columns: unit, whether it needs an allocation, and
 * whether it is paid (which is what payroll reads when prorating). The fourth,
 * the approval workflow, is identical for every type — it is the request state
 * machine — so it is not a per-type field.
 */
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPlus } from 'react-icons/lu'
import type { TimeOffTypeView } from '@/modules/timeoff/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const columns: ColumnDef<TimeOffTypeView, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs font-normal">
        {row.original.code}
      </Badge>
    ),
  },
  {
    accessorKey: 'unit',
    header: 'Unit',
    cell: ({ row }) => (row.original.unit === 'day' ? 'Days' : 'Hours'),
  },
  {
    accessorKey: 'requiresAllocation',
    header: 'Allocation',
    cell: ({ row }) =>
      row.original.requiresAllocation ? (
        <span className="text-sm">Required</span>
      ) : (
        <span className="text-sm text-muted-foreground">Not used</span>
      ),
  },
  {
    accessorKey: 'isPaid',
    header: 'Payroll',
    cell: ({ row }) =>
      row.original.isPaid ? (
        <span className="text-sm">Paid</span>
      ) : (
        <span className="text-sm text-muted-foreground">Unpaid</span>
      ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'archived'} />,
  },
]

export default function TimeOffTypesPage() {
  const router = useRouter()
  const params = useFilterParams(['isActive'])
  const { page, isLoading } = useResourceList<TimeOffTypeView>('time-off/types', params)

  return (
    <div>
      <PageHeader
        title="Time Off Types"
        description="Leave policies. The unit and allocation requirement decide how every request of this type behaves."
        actions={
          <Button asChild>
            <Link href="/time-off/types/new">
              <LuPlus aria-hidden />
              New type
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search types..."
        filters={[
          {
            name: 'isActive',
            label: 'Status',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ],
          },
        ]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/time-off/types/${row.id}`)}
        emptyMessage="No leave types configured"
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/time-off/types/new">Configure the first one</Link>
          </Button>
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
