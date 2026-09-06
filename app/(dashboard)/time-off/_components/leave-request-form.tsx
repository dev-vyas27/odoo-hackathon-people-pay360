'use client'

import Link from 'next/link'
import {
  leaveRequestSchema,
  type EmployeeOption,
  type LeaveRequestValues,
  type TimeOffTypeView,
} from '@/modules/timeoff/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { apiFetch } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { ResourceForm } from '@/components/resource/resource-form'
import { useCurrentUser, useScopedToSelf } from '@/components/auth/current-user'
import { Button } from '@/components/ui/button'

export function LeaveRequestForm({
  mode,
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
}: {
  mode: 'create' | 'edit'
  defaultValues: Partial<LeaveRequestValues>
  submitLabel: string
  onSubmit: (values: LeaveRequestValues) => Promise<void>
  cancel?: React.ReactNode
}) {
  const me = useCurrentUser()
  const selfOnly = useScopedToSelf()
  const isEditing = mode === 'edit'

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['time-off', 'employee-options'],
    queryFn: () => apiFetch<EmployeeOption[]>('/api/time-off/employee-options'),
    enabled: !isEditing && !selfOnly,
  })

  const { page: types } = useResourceList<TimeOffTypeView>('time-off/types', {
    isActive: 'true',
    limit: 100,
  })

  const typeOptions = types.items.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))
  const currentType = defaultValues.timeOffTypeId
  const options =
    currentType && !typeOptions.some((o) => o.value === currentType)
      ? [{ value: currentType, label: 'Current type (no longer offered)' }, ...typeOptions]
      : typeOptions

  return (
    <ResourceForm<LeaveRequestValues>
      schema={leaveRequestSchema}
      submitLabel={submitLabel}
      defaultValues={
        {
          employeeId: selfOnly ? me.employeeId : '',
          timeOffTypeId: '',
          reason: '',
          ...defaultValues,
        } as LeaveRequestValues
      }
      cancel={cancel}
      onSubmit={onSubmit}
      fields={[
        {
          name: 'employeeId',
          label: 'Employee',
          type: 'select',
          options: isEditing
            ? [{ value: defaultValues.employeeId ?? me.employeeId, label: me.name }]
            : selfOnly
              ? [{ value: me.employeeId, label: me.name }]
              : employees.map((e) => ({ value: e.id, label: e.name })),
          disabled: isEditing || selfOnly,
          description: isEditing
            ? 'A request cannot be moved to another person.'
            : selfOnly
              ? 'You can only raise your own requests.'
              : undefined,
        },
        { name: 'timeOffTypeId', label: 'Leave type', type: 'select', options },
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
    />
  )
}

export function CancelToRequests({ href = '/time-off/requests' }: { href?: string }) {
  return (
    <Button variant="ghost" asChild>
      <Link href={href}>Cancel</Link>
    </Button>
  )
}
