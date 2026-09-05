'use client'

/**
 * One form for creating and editing a contract.
 *
 * The date range is the important part: overlapping contracts for the same
 * employee are rejected by the use case AND by an exclusion constraint in the
 * database, so a clash surfaces as a clear 409 rather than corrupt history.
 * Leaving the end date empty means open-ended.
 *
 * ── Department and job position are NOT fields here ─────────────────────────
 *
 * They used to be, and they were editable inputs whose values went nowhere:
 * `contracts` has no such columns, so the API took them, returned 201 and threw
 * them away. Both are derived — `contract-query.adapter.ts` joins them through
 * the employee, which is what payroll reads. So they are shown as read-only
 * context below, sourced from the selected employee, and nothing pretends they
 * can be typed.
 *
 * The working schedule IS a real contract column and is a field, but a locked
 * one: payroll prorates a payslip against `contract.workingScheduleId`, so a
 * hand-edited schedule that disagrees with the employee's pays the wrong amount
 * and nothing downstream would notice.
 */
import { useWatch, useFormContext } from 'react-hook-form'
import { createContractSchema, type CreateContractBody } from '@/modules/employment/schemas'
import { ResourceForm } from '@/components/resource/resource-form'
import {
  useDepartmentOptions,
  useEmployeeOptions,
  useJobPositionOptions,
  useScheduleOptions,
} from '../../_components/options'

/**
 * Rendered inside ResourceForm, so it can watch the live employee selection and
 * show what this contract will inherit the moment one is chosen.
 */
function InheritedFromEmployee({
  employees,
  departments,
  positions,
}: {
  employees: ReturnType<typeof useEmployeeOptions>
  departments: ReturnType<typeof useDepartmentOptions>
  positions: ReturnType<typeof useJobPositionOptions>
}) {
  const { control } = useFormContext<CreateContractBody>()
  const employeeId = useWatch({ control, name: 'employeeId' })
  const employee = employees.items.find((e) => e.id === employeeId)

  const department =
    departments.options.find((d) => d.value === employee?.departmentId)?.label ?? null
  const position =
    positions.options.find((p) => p.value === employee?.jobPositionId)?.label ?? null

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        From the employee record
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground sm:text-xs">Department</dt>
          <dd className="text-foreground">{department ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground sm:text-xs">Job position</dt>
          <dd className="text-foreground">{position ?? '—'}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {employee
          ? 'Payroll reads these from the employee, so they are not stored on the contract. Change them on the employee record.'
          : 'Select an employee to see what this contract inherits.'}
      </p>
    </div>
  )
}

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
  const positions = useJobPositionOptions()
  const schedules = useScheduleOptions()

  return (
    <ResourceForm<CreateContractBody>
      schema={createContractSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      /**
       * Copy the employee's schedule onto the contract as soon as one is chosen.
       *
       * Only while CREATING. On an existing contract the schedule is a
       * historical fact: the employee may have moved onto different hours since,
       * and rewriting the contract to match today would restate what somebody
       * was actually paid against — the same reason payroll resolves a contract
       * by period rather than taking the latest.
       */
      derive={
        employeeLocked
          ? undefined
          : (values) => {
              if (!values.employeeId) return null
              const employee = employees.items.find((e) => e.id === values.employeeId)
              if (!employee) return null
              return { workingScheduleId: employee.workingScheduleId ?? undefined }
            }
      }
      fields={[
        {
          name: 'employeeId',
          label: 'Employee',
          type: 'select',
          options: employees.options,
          disabled: employeeLocked,
          placeholder: employees.isLoading ? 'Loading...' : 'Select employee',
          description: employeeLocked
            ? 'A contract cannot be moved to another employee.'
            : 'Their department, position and schedule come with them.',
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
          name: 'workingScheduleId',
          label: 'Working schedule',
          type: 'select',
          options: schedules.options,
          span: 2,
          // Locked: see the note at the top of this file.
          disabled: true,
          placeholder: 'Select an employee first',
          description: employeeLocked
            ? 'Recorded from the employee when this contract was created. Payroll prorates against it.'
            : "Taken from the employee's record. Payroll prorates against it.",
        },
      ]}
    >
      <InheritedFromEmployee
        employees={employees}
        departments={departments}
        positions={positions}
      />
    </ResourceForm>
  )
}
