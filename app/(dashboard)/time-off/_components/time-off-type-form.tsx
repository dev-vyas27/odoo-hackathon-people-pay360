'use client'



import { timeOffTypeSchema, type TimeOffTypeValues } from '@/modules/timeoff/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import { UNIT_OPTIONS } from './options'

export function TimeOffTypeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
  
  unitLocked = false,
  
  readOnly = false,
}: {
  defaultValues: TimeOffTypeValues
  submitLabel: string
  onSubmit: (values: TimeOffTypeValues) => Promise<void>
  cancel?: React.ReactNode
  unitLocked?: boolean
  readOnly?: boolean
}) {
  return (
    <ResourceForm<TimeOffTypeValues>
      schema={timeOffTypeSchema}
      submitLabel={submitLabel}
      readOnly={readOnly}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Paid Time Off' },
        {
          name: 'code',
          label: 'Code',
          placeholder: 'PL',
          description: 'Short, unique, upper case.',
        },
        {
          name: 'unit',
          label: 'Unit',
          type: 'select',
          options: UNIT_OPTIONS,
          disabled: unitLocked,
          description: unitLocked
            ? 'Locked: allocations already exist in this unit.'
            : 'Days for whole-day leave, hours for partial-day leave.',
        },
        {
          name: 'requiresAllocation',
          label: 'Requires an allocation',
          type: 'checkbox',
          description:
            'On: requests draw down a balance and are refused when it is short. Off: unlimited, like unpaid leave.',
        },
        {
          name: 'autoApprove',
          label: 'Auto-approve',
          type: 'checkbox',
          description:
            'On: a submitted request of this type is approved immediately — no manager has to act — and still draws down the allocation if one is required. Off (default): every request waits for a manual decision.',
        },
        {
          name: 'isPaid',
          label: 'Paid leave',
          type: 'checkbox',
          description: 'Read by payroll when prorating a payslip.',
        },
        {
          name: 'isActive',
          label: 'Active',
          type: 'checkbox',
          description: 'Inactive types cannot be requested, but their history is preserved.',
        },
      ]}
    />
  )
}
