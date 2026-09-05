'use client'

/**
 * One form for creating and editing a contract.
 *
 * The date range is the important part: overlapping contracts for the same
 * employee are rejected by the use case AND by an exclusion constraint in the
 * database, so a clash surfaces as a clear 409 rather than corrupt history.
 * Leaving the end date empty means open-ended.
 */
import { createContractSchema, type CreateContractBody } from '@/modules/employment/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import {
  useDepartmentOptions,
  useEmployeeOptions,
  useScheduleOptions,
} from '../../_components/options'

export function ContractForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
  /** Editing: an existing contract does not change hands. */
  employeeLocked = false,
}: {
  defaultValues: CreateContractBody
  submitLabel: string
  onSubmit: (values: CreateContractBody) => Promise<void>
  cancel?: React.ReactNode
  employeeLocked?: boolean
}) {
  const employees = useEmployeeOptions()
  const departments = useDepartmentOptions()
  const schedules = useScheduleOptions()

  return (
    <ResourceForm<CreateContractBody>
      schema={createContractSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      fields={[
        {
          name: 'employeeId',
          label: 'Employee',
          type: 'select',
          options: employees.options,
          disabled: employeeLocked,
          placeholder: employees.isLoading ? 'Loading...' : 'Select employee',
          description: employeeLocked ? 'A contract cannot be moved to another employee.' : undefined,
        },
        {
          name: 'wage',
          label: 'Wage',
          type: 'number',
          description: 'Gross monthly wage. Payroll prorates it by worked days.',
        },
        {
          name: 'start',
          label: 'Start date',
          type: 'date',
        },
        {
          name: 'end',
          label: 'End date',
          type: 'date',
          description: 'Leave empty for an open-ended contract.',
        },
        {
          name: 'jobPositionName',
          label: 'Job position',
          placeholder: 'Senior Engineer',
        },
        {
          name: 'departmentId',
          label: 'Department',
          type: 'select',
          options: departments.options,
          placeholder: departments.isLoading ? 'Loading...' : 'Select department',
        },
        {
          name: 'workingScheduleId',
          label: 'Working schedule',
          type: 'select',
          options: schedules.options,
          span: 2,
          placeholder: schedules.isLoading ? 'Loading...' : 'Select schedule',
          description: 'Payroll prorates against this schedule when computing the payslip.',
        },
      ]}
    />
  )
}
