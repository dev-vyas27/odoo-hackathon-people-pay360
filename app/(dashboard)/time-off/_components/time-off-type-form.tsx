'use client'

/**
 * One form for creating and editing a leave type.
 *
 * Shared rather than duplicated, because the two differ only in what happens on
 * submit — and a create form that drifts from its edit form is how a field ends
 * up settable but not changeable.
 */
import { timeOffTypeSchema, type TimeOffTypeValues } from '@/modules/timeoff/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import { UNIT_OPTIONS } from './options'

export function TimeOffTypeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
  /** The unit is locked once allocations exist — see UpdateTimeOffTypeUseCase. */
  unitLocked = false,
  /** A role that may read leave policy but not change it. */
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
