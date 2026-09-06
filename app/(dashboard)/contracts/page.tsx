'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPlus } from 'react-icons/lu'
import type { ContractListItem } from '@/modules/employment/schemas'
import type { EmployeeListItem } from '@/modules/people/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { formatDate, formatMoney, isCurrentContract } from '../_components/format'

export default function ContractsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employeeId') ?? undefined

  const params = useFilterParams(['employeeId'])
  const { page, isLoading } = useResourceList<ContractListItem>('contracts', params)

  const employees = useResourceList<EmployeeListItem>('employees', { limit: 200 })
  const employeeNames = new Map(employees.page.items.map((e) => [e.id, e.name]))
  const employeeOptions = employees.page.items.map((e) => ({ value: e.id, label: e.name }))

  const columns: ColumnDef<ContractListItem, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-medium">
          {employeeNames.get(row.original.employeeId) ?? row.original.employeeId.slice(0, 8)}
        </span>
      ),
    },
    {
      accessorKey: 'jobPositionName',
      header: 'Position',
      cell: ({ row }) => row.original.jobPositionName ?? '—',
    },
    {
      accessorKey: 'start',
      header: 'Start',
      
      
      meta: { sortKey: 'startsOn' },
      cell: ({ row }) => <span className="tabular">{formatDate(row.original.start)}</span>,
    },
    {
      accessorKey: 'end',
      header: 'End',
      meta: { sortKey: 'endsOn' },
      cell: ({ row }) => (
        <span className="tabular">
          {row.original.end ? formatDate(row.original.end) : 'Open-ended'}
        </span>
      ),
    },
    {
      accessorKey: 'wage',
      header: 'Wage',
      cell: ({ row }) => <span className="tabular">{formatMoney(row.original.wage)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      
      
      cell: ({ row }) => (
        <StatusBadge
          status={
            isCurrentContract(row.original.start, row.original.end)
              ? 'active'
              : new Date(row.original.start) > new Date()
                ? 'upcoming'
                : 'expired'
          }
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Employment terms over time. Payroll uses the contract covering the period being run, not simply the latest."
        actions={
          <Button asChild>
            <Link href={employeeId ? `/contracts/new?employeeId=${employeeId}` : '/contracts/new'}>
              <LuPlus aria-hidden />
              New contract
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search contracts..."
        filters={[{ name: 'employeeId', label: 'Employee', options: employeeOptions }]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/contracts/${row.id}`)}
        emptyMessage="No contracts match these filters"
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/contracts/new">Create the first one</Link>
          </Button>
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
