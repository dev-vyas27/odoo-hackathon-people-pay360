'use client'



import { createEmployeeSchema, type CreateEmployeeBody } from '@/modules/people/schemas'
import type { SelectOption } from '@/components/resource/resource-form'
import type { ScheduleType } from '@/modules/employment/schemas'
import { useCan } from '@/components/auth/current-user'
import { ResourceForm } from '@/components/resource/resource-form'
import {
  EMPLOYEE_TYPE_OPTIONS,
  useDepartmentOptions,
  useEmployeeOptions,
  useJobPositionOptions,
  useScheduleOptions,
} from '../../_components/options'



function schedulesFor<T extends { type: ScheduleType }>(
  employeeType: CreateEmployeeBody['employeeType'],
  schedules: T[],
): T[] {
  if (employeeType === 'full_time') return schedules.filter((s) => s.type === 'full_time')
  if (employeeType === 'part_time') return schedules.filter((s) => s.type === 'part_time')
  return schedules
}



function withCurrent(
  options: SelectOption[],
  value: string | null | undefined,
  label: string | null | undefined,
): SelectOption[] {
  if (!value || !label) return options
  if (options.some((option) => option.value === value)) return options
  return [{ value, label }, ...options]
}

export function EmployeeForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
  
  employeeId,
  currentNames,
}: {
  defaultValues: CreateEmployeeBody
  submitLabel: string
  onSubmit: (values: CreateEmployeeBody) => Promise<void>
  cancel?: React.ReactNode
  employeeId?: string
  


  currentNames?: {
    departmentName: string | null
    jobPositionName: string | null
    managerName: string | null
    workingScheduleName: string | null
  }
}) {
  const departments = useDepartmentOptions()
  const positions = useJobPositionOptions()
  const schedules = useScheduleOptions()
  const managers = useEmployeeOptions(employeeId)

  
  const isEditing = Boolean(employeeId)

  


  const canEdit = useCan('employee', isEditing ? 'update' : 'create')

  return (
    <ResourceForm<CreateEmployeeBody>
      schema={createEmployeeSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      readOnly={!canEdit}
      


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
          options: withCurrent(
            departments.options,
            values.departmentId,
            currentNames?.departmentName,
          ),
          placeholder: departments.isLoading ? 'Loading...' : 'Select department',
          section: 'Organisation',
        },
        {
          name: 'jobPositionId',
          label: 'Job position',
          type: 'select',
          options: withCurrent(
            positions.options,
            values.jobPositionId,
            currentNames?.jobPositionName,
          ),
          placeholder: positions.isLoading ? 'Loading...' : 'Select position',
          section: 'Organisation',
        },
        {
          name: 'managerId',
          label: 'Manager',
          type: 'select',
          options: withCurrent(managers.options, values.managerId, currentNames?.managerName),
          placeholder: managers.isLoading ? 'Loading...' : 'Select manager',
          section: 'Organisation',
        },
        {
          name: 'workingScheduleId',
          label: 'Working schedule',
          type: 'select',
          
          options: withCurrent(
            schedulesFor(values.employeeType, schedules.items).map((s) => ({
              value: s.id,
              label: `${s.name} (${s.weeklyHours}h)`,
            })),
            values.workingScheduleId,
            currentNames?.workingScheduleName,
          ),
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
