'use client'

import { useWatch, useFormContext } from 'react-hook-form'
import { createContractSchema, type CreateContractBody } from '@/modules/employment/schemas'
import type { SalaryStructureListItem } from '@/modules/payroll-config'
import { ResourceForm } from '@/components/resource/resource-form'
import { useCan } from '@/components/auth/current-user'
import { useResourceList } from '@/hooks/use-resource'
import {
  useDepartmentOptions,
  useEmployeeOptions,
  useJobPositionOptions,
  useScheduleOptions,
} from '../../_components/options'

function useSalaryStructureOptions(enabled: boolean) {
  
  
  
  
  
  
  
  const { page, isLoading } = useResourceList<SalaryStructureListItem>(
    'payroll/structures',
    { limit: 200 },
    { enabled },
  )
  return {
    isLoading: enabled && isLoading,
    options: page.items.map((s) => ({ value: s.id, label: s.name })),
  }
}

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
    <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
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
  
  
  
  const canReadStructures = useCan('salary_structure', 'read')
  const salaryStructures = useSalaryStructureOptions(canReadStructures)

  return (
    <ResourceForm<CreateContractBody>
      schema={createContractSchema}
      submitLabel={submitLabel}
      defaultValues={defaultValues}
      cancel={cancel}
      onSubmit={onSubmit}
      

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
            : 'Inherits department, position & schedule.',
        },
        {
          name: 'wage',
          label: 'Wage',
          type: 'number',
          description: 'Gross monthly wage, prorated by worked days.',
        },
        {
          name: 'salaryStructureId',
          label: 'Salary structure',
          type: 'select',
          options: salaryStructures.options,
          disabled: !canReadStructures,
          placeholder: salaryStructures.isLoading ? 'Loading...' : 'Select salary structure',
          description: canReadStructures
            ? 'The rule set payroll computes this contract’s payslips from.'
            : 'Set by payroll — your role does not have access to salary structures.',
        },
        {
          name: 'start',
          label: 'Start date',
          type: 'date',
          description: 'First day this contract takes effect.',
        },
        {
          name: 'end',
          label: 'End date',
          type: 'date',
          description: 'Leave empty for open-ended contract.',
        },
        {
          name: 'workingScheduleId',
          label: 'Working schedule',
          type: 'select',
          options: schedules.options,
          span: 2,
          
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
