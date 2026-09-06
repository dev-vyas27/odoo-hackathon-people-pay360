'use client'

/**
 * The Attendance list (spec B3): "List view displays Check In, Check Out,
 * Worked Hours, and Status for quick review of entries and exceptions."
 *
 * Reached globally from the nav, or filtered to one person from the employee
 * form's smart button — hence employeeId as a URL parameter.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPlus } from 'react-icons/lu'
import type { AttendanceListItem } from '@/modules/attendance/schemas'
import { ATTENDANCE_STATUSES } from '@/modules/attendance/schemas'
import type { EmployeeListItem } from '@/modules/people/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useScopedToSelf } from '@/components/auth/current-user'
import { formatDate, formatHours, formatTime } from '../_components/format'
import { ClockWidget } from './_components/clock-widget'

const STATUS_OPTIONS = ATTENDANCE_STATUSES.map((status) => ({
  value: status,
  label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

export default function AttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employeeId') ?? undefined

  /**
   * Self-service for the person the records are about; the HR form for anybody
   * filing on someone else's behalf.
   *
   * A row-scoped role sees exactly one employee's attendance — their own — so
   * "Record attendance" would open a form whose only possible subject is
   * themselves, with a date and time they would have to type. The clock is that
   * form, already filled in.
   */
  const me = useCurrentUser()
  const selfService = useScopedToSelf()

  const params = useFilterParams(['employeeId', 'status'])
  const { page, isLoading } = useResourceList<AttendanceListItem>('attendance', params)

  const employees = useResourceList<EmployeeListItem>('employees', { limit: 200 })
  const employeeNames = new Map(employees.page.items.map((e) => [e.id, e.name]))
  const employeeOptions = employees.page.items.map((e) => ({ value: e.id, label: e.name }))

  const columns: ColumnDef<AttendanceListItem, unknown>[] = [
    ...(selfService
      ? []
      : [
          {
            id: 'employee',
            header: 'Employee',
            enableSorting: false,
            cell: ({ row }: { row: { original: AttendanceListItem } }) => (
              <span className="font-medium">
                {employeeNames.get(row.original.employeeId) ?? row.original.employeeId.slice(0, 8)}
              </span>
            ),
          },
        ]),
    {
      accessorKey: 'checkIn',
      header: 'Date',
      cell: ({ row }) => <span className="tabular">{formatDate(row.original.checkIn)}</span>,
    },
    {
      id: 'checkInTime',
      header: 'Check In',
      enableSorting: false,
      cell: ({ row }) => <span className="tabular">{formatTime(row.original.checkIn)}</span>,
    },
    {
      id: 'checkOutTime',
      header: 'Check Out',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular">
          {row.original.checkOut ? formatTime(row.original.checkOut) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'workedHours',
      header: 'Worked Hours',
      cell: ({ row }) => <span className="tabular">{formatHours(row.original.workedHours)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily presence and its exceptions. Worked hours feed the payslip; corrections are flagged and stay visible."
        actions={
          selfService ? (
            <ClockWidget employeeId={me.employeeId} />
          ) : (
            <Button asChild>
              <Link
                href={employeeId ? `/attendance/new?employeeId=${employeeId}` : '/attendance/new'}
              >
                <LuPlus aria-hidden />
                Record attendance
              </Link>
            </Button>
          )
        }
      />

      <FilterBar
        showSearch={!selfService}
        searchPlaceholder="Search attendance..."
        filters={
          selfService
            ? [{ name: 'status', label: 'Status', options: STATUS_OPTIONS }]
            : [
                { name: 'employeeId', label: 'Employee', options: employeeOptions },
                { name: 'status', label: 'Status', options: STATUS_OPTIONS },
              ]
        }
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/attendance/${row.id}`)}
        emptyMessage={
          selfService
            ? 'Nothing recorded yet. Use Check In above to start your first shift.'
            : 'No attendance records match these filters'
        }
        /**
         * No empty-state button for a self-service role: the clock in the header
         * is the way in, and a second control that opens a manual form the role
         * cannot usefully fill would be pointing away from it.
         */
        emptyAction={
          selfService ? undefined : (
            <Button variant="outline" asChild>
              <Link href="/attendance/new">Record the first entry</Link>
            </Button>
          )
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
