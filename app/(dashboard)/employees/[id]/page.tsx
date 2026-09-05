'use client'

/**
 * The Employee hub (spec B2).
 *
 * Three bands, in the order somebody actually reads them:
 *
 *   1. WHO — an identity strip: initials, name, where they sit, whether they
 *      are active. Answerable at a glance, without reading a form.
 *   2. WHAT ELSE — the smart buttons, each opening the related list already
 *      filtered to this person. The spec calls these the main navigation
 *      device, so they sit above the form rather than below it.
 *   3. EDIT — the form, grouped into Identity / Organisation / Pay and hours /
 *      Status instead of nine inputs in one undifferentiated grid.
 *
 * The counts are fetched from the same endpoints the buttons link to. The
 * original design took them from the detail call to save round trips, which was
 * the better idea — but that call hardcodes them to zero (those aggregates
 * belong to other modules, and no count port exists yet). A confident "0
 * Contracts" beside an employee who has two is worse than three small requests.
 * See the note in get-employee-detail.use-case.ts.
 */
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
import { PageHeader } from '@/components/resource/page-header'
import { SmartButton } from '@/components/resource/smart-button'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EmployeeForm } from '../_components/employee-form'
import { useDepartmentOptions, useJobPositionOptions } from '../../_components/options'

/** `limit: 1` — we want the envelope's `total`, not the rows. */
const COUNT_ONLY = { limit: 1 } as const

function useRelatedCount(resource: string, employeeId: string) {
  const { page } = useResourceList<unknown>(resource, { ...COUNT_ONLY, employeeId })
  return page.total
}

/** Two initials, or one for a mononym. Cheap avatar, no upload story needed. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: route params arrive as a promise.
  const { id } = use(params)
  const router = useRouter()

  const { data: employee, isLoading } = useResourceItem<EmployeeDetailView>('employees', id)
  const update = useUpdateResource<EmployeeDetailView, CreateEmployeeBody>('employees', {
    successMessage: 'Employee updated',
  })
  const archive = useDeleteResource('employees', { successMessage: 'Employee archived' })

  // Named lookups for the identity strip. Both are already cached by the form's
  // own pickers, so this costs nothing extra.
  const departments = useDepartmentOptions()
  const positions = useJobPositionOptions()

  const contracts = useRelatedCount('contracts', id)
  const attendance = useRelatedCount('attendance', id)
  const timeOff = useRelatedCount('time-off/requests', id)
  const allocations = useRelatedCount('time-off/allocations', id)

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

  const departmentName = departments.options.find((o) => o.value === employee.departmentId)?.label
  const positionName = positions.options.find((o) => o.value === employee.jobPositionId)?.label

  /** "Sales · Account Executive · Full Time", skipping whatever is not set. */
  const placement = [departmentName, positionName, EMPLOYEE_TYPE_LABELS[employee.employeeType]]
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

      {/* 1. WHO ─────────────────────────────────────────────────────────── */}
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

      {/* 2. WHAT ELSE ───────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SmartButton
          icon={LuFileText}
          label="Contracts"
          count={contracts}
          href={`/contracts?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuCalendarClock}
          label="Attendance"
          count={attendance}
          href={`/attendance?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuPlaneTakeoff}
          label="Time Off"
          count={timeOff}
          href={`/time-off/requests?employeeId=${employee.id}`}
        />
        <SmartButton
          icon={LuWallet}
          label="Allocations"
          count={allocations}
          href={`/time-off/allocations?employeeId=${employee.id}`}
        />
      </div>

      {/* 3. EDIT ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-6">
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
