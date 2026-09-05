'use client'

/**
 * The Employee list — the operational hub of the whole app (spec A1, B1).
 *
 * Two views over one query: Kanban and List, both opening the same form. The
 * toggle lives in the URL so a view choice survives a refresh and can be linked
 * to, which matters when someone pastes a filtered list into the team chat.
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { LuLayoutGrid, LuList } from 'react-icons/lu'
import {
  EMPLOYEE_TYPE_LABELS,
  type DepartmentListItem,
  type EmployeeListItem,
} from '@/modules/people/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { cn } from '@/lib/utils'
import { EMPLOYEE_TYPE_OPTIONS, ACTIVE_OPTIONS } from '../_components/options'
import { EmployeeKanban } from './_components/employee-kanban'

export default function EmployeesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'list'

  const params = useFilterParams(['employeeType', 'isActive'])
  const { page, isLoading } = useResourceList<EmployeeListItem>('employees', params)

  // Departments are a handful of rows and every card and cell needs the name.
  const departments = useResourceList<DepartmentListItem>('departments', { limit: 200 })
  const departmentNames = new Map(departments.page.items.map((d) => [d.id, d.name]))

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
      cell: ({ row }) =>
        row.original.departmentId
          ? (departmentNames.get(row.original.departmentId) ?? '—')
          : '—',
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
        /*
         * No "New employee" button here. Since migration 0010 an account IS an
         * employee, so a person is created once, in User administration —
         * leaving the password blank there produces exactly the HR-record-
         * without-a-login this button used to make. Two creation paths writing
         * one table is how two people end up sharing an email.
         */
        actions={
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
        <EmployeeKanban
          employees={page.items}
          departmentNames={departmentNames}
          isLoading={isLoading}
        />
      ) : (
        <ResourceTable
          data={page.items}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/employees/${row.id}`)}
          emptyMessage="No employees match these filters"
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
