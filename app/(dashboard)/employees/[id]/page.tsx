'use client'

/**
 * The Employee form — the spec's operational hub (section B2).
 *
 * Identity and role at the top, then smart buttons: counts of the related
 * records, each opening the matching list already filtered to this employee.
 * That is the app's main navigation device, so the counts come from one
 * detail request rather than four client-side round trips.
 */
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuCalendarClock, LuFileText, LuPlaneTakeoff, LuWallet } from 'react-icons/lu'
import type { CreateEmployeeBody, EmployeeDetailView } from '@/modules/people/schemas'
import { useResourceItem, useUpdateResource, useDeleteResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { SmartButton } from '@/components/resource/smart-button'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeForm } from '../_components/employee-form'

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: route params arrive as a promise.
  const { id } = use(params)
  const router = useRouter()

  const { data: employee, isLoading } = useResourceItem<EmployeeDetailView>('employees', id)
  const update = useUpdateResource<EmployeeDetailView, CreateEmployeeBody>('employees', {
    successMessage: 'Employee updated',
  })
  const archive = useDeleteResource('employees', { successMessage: 'Employee archived' })

  if (isLoading || !employee) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={employee.name}
        description={employee.email}
        actions={
          <>
            <StatusBadge status={employee.isActive ? 'active' : 'archived'} />
            <ConfirmDialog
              title="Archive this employee?"
              description="Their contracts, attendance and time off are preserved. They stop appearing in new payruns."
              confirmLabel="Archive"
              destructive
              trigger={<Button variant="outline">Archive</Button>}
              onConfirm={async () => {
                await archive.mutateAsync(id)
                router.push('/employees')
              }}
            />
          </>
        }
      />

      {/* Spec B2: counts that open the related list, already filtered. */}
      <div className="mb-8 flex flex-wrap gap-3">
        <SmartButton
          icon={LuFileText}
          label="Contracts"
          count={employee.counts.contracts}
          href={`/contracts?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuCalendarClock}
          label="Attendance"
          count={employee.counts.attendance}
          href={`/attendance?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuPlaneTakeoff}
          label="Time Off"
          count={employee.counts.timeOff}
          href={`/time-off/requests?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuWallet}
          label="Allocations"
          count={employee.counts.allocations}
          href={`/time-off/allocations?employeeId=${employee.id}`}
        />
      </div>

      <EmployeeForm
        employeeId={employee.id}
        submitLabel="Save changes"
        defaultValues={{
          name: employee.name,
          email: employee.email,
          employeeType: employee.employeeType,
          departmentId: employee.departmentId ?? undefined,
          jobPositionId: employee.jobPositionId ?? undefined,
          managerId: employee.managerId ?? undefined,
          workingScheduleId: employee.workingScheduleId ?? undefined,
          bankAccount: employee.bankAccount ?? undefined,
          isActive: employee.isActive,
        }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/employees">Back to list</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
        }}
      />
    </div>
  )
}
