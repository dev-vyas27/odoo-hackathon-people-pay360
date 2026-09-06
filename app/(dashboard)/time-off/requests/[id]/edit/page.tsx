'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuArrowLeft } from 'react-icons/lu'
import type { LeaveRequestValues, UpdateLeaveRequestValues } from '@/modules/timeoff/schemas'
import type { LeaveRequestDetail } from '@/modules/timeoff/schemas'
import { useResourceItem, useUpdateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CancelToRequests, LeaveRequestForm } from '../../../_components/leave-request-form'

const RESOURCE = 'time-off/requests'

export default function EditLeaveRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: request, isLoading } = useResourceItem<LeaveRequestDetail>(RESOURCE, id)
  const update = useUpdateResource<LeaveRequestDetail, UpdateLeaveRequestValues>(RESOURCE, {
    successMessage: 'Request updated',
  })

  if (isLoading || !request) {
    return <Skeleton className="h-96 w-full max-w-3xl" />
  }

  if (!request.canEdit) {
    return (
      <div className="max-w-3xl">
        <PageHeader
          title="This request can no longer be changed"
          description={`It has already been ${request.status.replace(/_/g, ' ')}. Raise a new request instead.`}
          actions={
            <Button variant="outline" asChild>
              <Link href={`/time-off/requests/${id}`}>
                <LuArrowLeft aria-hidden />
                Back
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Edit time off request"
        description="Still awaiting a decision, so the dates, type and reason can all be changed. The balance is re-checked when you save."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/time-off/requests/${id}`}>
              <LuArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      <LeaveRequestForm
        mode="edit"
        submitLabel="Save changes"
        defaultValues={{
          employeeId: request.employeeId,
          timeOffTypeId: request.timeOffTypeId,
          start: new Date(request.start),
          end: new Date(request.end),
          duration: request.duration,
          reason: request.reason ?? '',
        } as Partial<LeaveRequestValues>}
        cancel={<CancelToRequests href={`/time-off/requests/${id}`} />}
        onSubmit={async (values) => {
          await update.mutateAsync({
            id,
            values: {
              timeOffTypeId: values.timeOffTypeId,
              start: values.start,
              end: values.end,
              duration: values.duration,
              reason: values.reason ?? '',
            },
          })
          router.push(`/time-off/requests/${id}`)
        }}
      />
    </div>
  )
}
