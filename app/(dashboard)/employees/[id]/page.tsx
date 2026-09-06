'use client'



import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LuArrowLeft,
  LuBuilding2,
  LuCalendarClock,
  LuFileText,
  LuPlaneTakeoff,
  LuWallet,
} from 'react-icons/lu'
import type { CreateEmployeeBody, EmployeeDetailView } from '@/modules/people/schemas'
import { EMPLOYEE_TYPE_LABELS } from '@/modules/people/schemas'
import {
  useResourceItem,
  useResourceList,
  useUpdateResource,
  useDeleteResource,
} from '@/hooks/use-resource'
import { useCan } from '@/components/auth/current-user'
import { PageHeader } from '@/components/resource/page-header'
import { SmartButton } from '@/components/resource/smart-button'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EmployeeForm } from '../_components/employee-form'


const COUNT_ONLY = { limit: 1 } as const

function useRelatedCount(resource: string, employeeId: string) {
  const { page } = useResourceList<unknown>(resource, { ...COUNT_ONLY, employeeId })
  return page.total
}


function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  
  const { id } = use(params)
  const router = useRouter()

  


  const canArchive = useCan('employee', 'delete')

  const { data: employee, isLoading } = useResourceItem<EmployeeDetailView>('employees', id)
  const update = useUpdateResource<EmployeeDetailView, CreateEmployeeBody>('employees', {
    successMessage: 'Employee updated',
  })
  const archive = useDeleteResource('employees', { successMessage: 'Employee archived' })

  const contracts = useRelatedCount('contracts', id)
  const attendance = useRelatedCount('attendance', id)
  const timeOff = useRelatedCount('time-off/requests', id)
  const allocations = useRelatedCount('time-off/allocations', id)

  


  const canSee = {
    contracts: useCan('contract', 'read'),
    attendance: useCan('attendance', 'read'),
    timeOff: useCan('leave_request', 'read'),
    allocations: useCan('allocation', 'read'),
  }

  if (isLoading || !employee) {
    return (
      <div className="max-w-4xl space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  


  const placement = [
    employee.departmentName,
    employee.jobPositionName,
    EMPLOYEE_TYPE_LABELS[employee.employeeType],
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={employee.name}
        description={employee.email}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/employees">
                <LuArrowLeft aria-hidden />
                Back
              </Link>
            </Button>
            {canArchive ? (
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
            ) : null}
          </>
        }
      />

      {}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <span
            aria-hidden
            className={cn(
              'flex size-14 shrink-0 items-center justify-center rounded-full',
              'bg-primary/10 text-lg font-medium text-primary',
            )}
          >
            {initialsOf(employee.name)}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-base font-medium text-foreground">{employee.name}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <LuBuilding2 className="size-3.5 shrink-0" aria-hidden />
              {placement || 'No department or position set'}
            </p>
          </div>

          <StatusBadge status={employee.isActive ? 'active' : 'archived'} />
        </CardContent>
      </Card>

      {}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {canSee.contracts ? (
          <SmartButton
            icon={LuFileText}
            label="Contracts"
            count={contracts}
            href={`/contracts?employeeId=${employee.id}`}
          />
        ) : null}
        {canSee.attendance ? (
          <SmartButton
            icon={LuCalendarClock}
            label="Attendance"
            count={attendance}
            href={`/attendance?employeeId=${employee.id}`}
          />
        ) : null}
        {canSee.timeOff ? (
          <SmartButton
            icon={LuPlaneTakeoff}
            label="Time Off"
            count={timeOff}
            href={`/time-off/requests?employeeId=${employee.id}`}
          />
        ) : null}
        {canSee.allocations ? (
          <SmartButton
            icon={LuWallet}
            label="Allocations"
            count={allocations}
            href={`/time-off/allocations?employeeId=${employee.id}`}
          />
        ) : null}
      </div>

      {}
      <Card>
        <CardContent className="py-6">
          <EmployeeForm
            employeeId={employee.id}
            submitLabel="Save changes"
            

            currentNames={{
              departmentName: employee.departmentName,
              jobPositionName: employee.jobPositionName,
              managerName: employee.managerName,
              workingScheduleName: employee.workingScheduleName,
            }}
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
                <Link href="/employees">Cancel</Link>
              </Button>
            }
            onSubmit={async (values) => {
              await update.mutateAsync({ id, values })
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
