'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  leaveRequestSchema,
  type EmployeeOption,
  type LeaveRequestValues,
  type TimeOffTypeView,
} from '@/modules/timeoff/schemas'
import { useCreateResource, useResourceList } from '@/hooks/use-resource'
import { apiFetch } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { useCurrentUser, useScopedToSelf } from '@/components/auth/current-user'
import { Button } from '@/components/ui/button'

export default function NewLeaveRequestPage() {
  const router = useRouter()
  const me = useCurrentUser()
  const selfOnly = useScopedToSelf()

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['time-off', 'employee-options'],
    queryFn: () => apiFetch<EmployeeOption[]>('/api/time-off/employee-options'),
  })

  
  const { page: types } = useResourceList<TimeOffTypeView>('time-off/types', {
    isActive: 'true',
    limit: 100,
  })

  const create = useCreateResource<{ id: string }, LeaveRequestValues>('time-off/requests', {
    successMessage: 'Request submitted for approval',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New time off request"
        description="Leave types that require an allocation are checked against the balance before the request is accepted."
      />

      <ResourceForm<LeaveRequestValues>
        schema={leaveRequestSchema}
        submitLabel="Submit request"
        defaultValues={{
          employeeId: selfOnly ? me.employeeId : '',
          timeOffTypeId: '',
          reason: '',
        }}
        fields={[
          {
            name: 'employeeId',
            label: 'Employee',
            type: 'select',
            

            options: selfOnly
              ? [{ value: me.employeeId, label: me.name }]
              : employees.map((e) => ({ value: e.id, label: e.name })),
            disabled: selfOnly,
            description: selfOnly ? 'You can only raise your own requests.' : undefined,
          },
          {
            name: 'timeOffTypeId',
            label: 'Leave type',
            type: 'select',
            options: types.items.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.code})`,
            })),
          },
          { name: 'start', label: 'From', type: 'date' },
          { name: 'end', label: 'To', type: 'date' },
          {
            name: 'duration',
            label: 'Duration',
            type: 'number',
            description:
              'Leave blank for whole days. Enter a value for half days, or for hour-based leave types.',
          },
          { name: 'reason', label: 'Reason', type: 'textarea', span: 2 },
        ]}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/time-off/requests">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          const created = await create.mutateAsync(values)
          router.push(`/time-off/requests/${created.id}`)
        }}
      />
    </div>
  )
}
