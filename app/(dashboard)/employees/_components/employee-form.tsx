'use client'

/**
 * One form for creating and editing an employee.
 *
 * Shared rather than duplicated: the two differ only in what submit does, and a
 * create form that drifts from its edit form is how a field ends up settable
 * but not changeable.
 */
import { createEmployeeSchema, type CreateEmployeeBody } from '@/modules/people/schemas'
import { isFullTimeSchedule } from '@/modules/employment/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import {
  EMPLOYEE_TYPE_OPTIONS,
  useDepartmentOptions,
  useEmployeeOptions,
  useJobPositionOptions,
  useScheduleOptions,
} from '../../_components/options'

/**
 * Which schedules suit an employee type.
 *
 * A full-timer on a 20-hour schedule would be judged late against hours they
 * were never meant to work, and prorated down to half pay — the schedule is
 * what attendance and payroll measure against, so the pairing has to hold.
 *
 * Interns and contractors are deliberately unrestricted: their hours are the
 * negotiated ones, and there is no honest default to pick for them.
 */
function schedulesFor<T extends { weeklyHours: number }>(
  employeeType: CreateEmployeeBody['employeeType'],
  schedules: T[],
): T[] {
  if (employeeType === 'full_time') return schedules.filter((s) => isFullTimeSchedule(s.weeklyHours))
  if (employeeType === 'part_time') return schedules.filter((s) => !isFullTimeSchedule(s.weeklyHours))
  return schedules
}

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

  /** Editing an existing record rather than creating one. */
  const isEditing = Boolean(employeeId)

  return (
    <ResourceForm<CreateEmployeeBody>
      schema={createEmployeeSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      /**
       * Keep the schedule consistent with the employee type.
       *
       * Only fires when the current choice is not valid for the type — so an
       * intern's negotiated schedule is never overwritten, and a full-timer who
       * already has the 40-hour one is left alone. Switching someone to part
       * time moves them onto a part-time schedule rather than silently leaving
       * them on hours their pay will now be prorated against.
       *
       * Nothing is auto-picked for interns and contractors: `allowed` is every
       * schedule for them, so a current value is always valid and an empty one
       * stays empty for a human to choose.
       */
      derive={(values) => {
        const allowed = schedulesFor(values.employeeType, schedules.items)
        if (allowed.length === 0) return null
        if (values.workingScheduleId && allowed.some((s) => s.id === values.workingScheduleId)) {
          return null
        }
        if (values.employeeType !== 'full_time' && values.employeeType !== 'part_time') return null
        return { workingScheduleId: allowed[0].id }
      }}
      fields={(values) => [
        { name: 'name', label: 'Name', placeholder: 'Priya Sharma', section: 'Identity' },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'priya@company.com',
          section: 'Identity',
          /**
           * Read-only once the record exists. Since migration 0010 the employee
           * row IS the login, so this address is the credential someone signs in
           * with — editing it in an HR form would silently lock them out, and
           * every payslip already sent quotes it. Changing it is an account
           * operation, not an HR edit.
           */
          disabled: isEditing,
          description: isEditing
            ? 'The sign-in address. Change it from account administration.'
            : undefined,
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
          // Narrowed to the schedules that suit the chosen employee type.
          options: schedulesFor(values.employeeType, schedules.items).map((s) => ({
            value: s.id,
            label: `${s.name} (${s.weeklyHours}h)`,
          })),
          placeholder: schedules.isLoading ? 'Loading...' : 'Select schedule',
          description:
            values.employeeType === 'full_time'
              ? 'Full-time employees are on a full-time schedule.'
              : values.employeeType === 'part_time'
                ? 'Part-time employees are on a part-time schedule.'
                : 'Attendance judges lateness and overtime against this.',
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
