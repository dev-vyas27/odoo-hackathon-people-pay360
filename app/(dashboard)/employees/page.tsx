'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuLayoutGrid, LuList, LuPlus } from 'react-icons/lu'
import {
  EMPLOYEE_TYPE_LABELS,
  type EmployeeListItem,
} from '@/modules/people/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/auth/current-user'
import { cn } from '@/lib/utils'
import { EMPLOYEE_TYPE_OPTIONS, ACTIVE_OPTIONS } from '../_components/options'
import { EmployeeKanban } from './_components/employee-kanban'

export default function EmployeesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'list'

  
  const canCreate = useCan('employee', 'create')

  const params = useFilterParams(['employeeType', 'isActive'])
  const { page, isLoading } = useResourceList<EmployeeListItem>('employees', params)

  function setView(next: 'list' | 'kanban') {
    const query = new URLSearchParams(searchParams.toString())
    if (next === 'list') query.delete('view')
    else query.set('view', next)
    router.replace(`${pathname}?${query.toString()}`, { scroll: false })
  }

  const columns: ColumnDef<EmployeeListItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'department',
      header: 'Department',
      enableSorting: false,
      cell: ({ row }) => row.original.departmentName ?? '—',
    },
    {
      accessorKey: 'employeeType',
      header: 'Type',
      cell: ({ row }) => EMPLOYEE_TYPE_LABELS[row.original.employeeType],
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'archived'} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Employees"
        description="The central record. Contracts, attendance and time off all hang off an employee."
        actions={
          <>
            <div className="flex rounded-md border border-border p-0.5">
              <ViewToggle
                active={view === 'list'}
                onClick={() => setView('list')}
                icon={<LuList className="size-4" aria-hidden />}
                label="List view"
              />
              <ViewToggle
                active={view === 'kanban'}
                onClick={() => setView('kanban')}
                icon={<LuLayoutGrid className="size-4" aria-hidden />}
                label="Kanban view"
              />
            </div>
            {canCreate ? (
              <Button asChild>
                <Link href="/employees/new">
                  <LuPlus aria-hidden />
                  New employee
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        searchPlaceholder="Search by name or email..."
        filters={[
          { name: 'employeeType', label: 'Type', options: EMPLOYEE_TYPE_OPTIONS },
          { name: 'isActive', label: 'Status', options: ACTIVE_OPTIONS },
        ]}
      />

      {view === 'kanban' ? (
        <EmployeeKanban employees={page.items} isLoading={isLoading} />
      ) : (
        <ResourceTable
          data={page.items}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/employees/${row.id}`)}
          emptyMessage="No employees match these filters"
          emptyAction={
            canCreate ? (
              <Button variant="outline" asChild>
                <Link href="/employees/new">Add the first one</Link>
              </Button>
            ) : undefined
          }
        />
      )}

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'rounded px-2.5 py-1.5 transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
    </button>
  )
}
