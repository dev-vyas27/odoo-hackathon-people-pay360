'use client'

import { useRouter } from 'next/navigation'
import type { LeaveRequestValues } from '@/modules/timeoff/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { CancelToRequests, LeaveRequestForm } from '../../_components/leave-request-form'

export default function NewLeaveRequestPage() {
  const router = useRouter()

  const create = useCreateResource<{ id: string }, LeaveRequestValues>('time-off/requests', {
    successMessage: 'Request submitted for approval',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New time off request"
        description="Leave types that require an allocation are checked against the balance before the request is accepted."
      />

      <LeaveRequestForm
        mode="create"
        submitLabel="Submit request"
        defaultValues={{}}
        cancel={<CancelToRequests />}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(values)
          router.push(`/time-off/requests/${created.id}`)
        }}
      />
    </div>
  )
}
