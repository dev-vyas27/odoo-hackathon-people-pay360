'use client'

/**
 * One form for creating and editing an employee.
 *
 * Shared rather than duplicated: the two differ only in what submit does, and a
 * create form that drifts from its edit form is how a field ends up settable
 * but not changeable.
 */
import { createEmployeeSchema, type CreateEmployeeBody } from '@/modules/people/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import {
  EMPLOYEE_TYPE_OPTIONS,
  useDepartmentOptions,
  useEmployeeOptions,
  useJobPositionOptions,
  useScheduleOptions,
} from '../../_components/options'

export function EmployeeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
  /** Editing: the employee cannot be offered as their own manager. */
  employeeId,
}: {
  defaultValues: CreateEmployeeBody
  submitLabel: string
  onSubmit: (values: CreateEmployeeBody) => Promise<void>
  cancel?: React.ReactNode
  employeeId?: string
}) {
  const departments = useDepartmentOptions()
  const positions = useJobPositionOptions()
  const schedules = useScheduleOptions()
  const managers = useEmployeeOptions(employeeId)

  return (
    <ResourceForm<CreateEmployeeBody>
      schema={createEmployeeSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      fields={[
        { name: 'name', label: 'Name', placeholder: 'Priya Sharma', section: 'Identity' },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'priya@company.com',
          section: 'Identity',
        },
        {
          name: 'employeeType',
          label: 'Employee type',
          type: 'select',
          options: EMPLOYEE_TYPE_OPTIONS,
          description: 'Drives dashboard filtering and payroll eligibility.',
          section: 'Organisation',
        },
        {
          name: 'departmentId',
          label: 'Department',
          type: 'select',
          options: departments.options,
          placeholder: departments.isLoading ? 'Loading...' : 'Select department',
          section: 'Organisation',
        },
        {
          name: 'jobPositionId',
          label: 'Job position',
          type: 'select',
          options: positions.options,
          placeholder: positions.isLoading ? 'Loading...' : 'Select position',
          section: 'Organisation',
        },
        {
          name: 'managerId',
          label: 'Manager',
          type: 'select',
          options: managers.options,
          placeholder: managers.isLoading ? 'Loading...' : 'Select manager',
          section: 'Organisation',
        },
        {
          name: 'workingScheduleId',
          label: 'Working schedule',
          type: 'select',
          options: schedules.options,
          placeholder: schedules.isLoading ? 'Loading...' : 'Select schedule',
          description: 'Attendance judges lateness and overtime against this.',
          section: 'Pay and hours',
        },
        {
          name: 'bankAccount',
          label: 'Bank account',
          placeholder: 'Account number',
          description: 'Payroll warns before finalising a payrun when this is missing.',
          section: 'Pay and hours',
        },
        {
          name: 'isActive',
          label: 'Active',
          type: 'checkbox',
          span: 2,
          description: 'Archived employees keep their history but are excluded from payruns.',
          section: 'Status',
        },
      ]}
    />
  )
}
