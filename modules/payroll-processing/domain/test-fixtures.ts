


import { Period } from '@/modules/shared'
import type { EmployeeSummary } from '@/modules/shared'
import type { ContractSnapshot } from '@/modules/shared'
import {
  createSalaryRule,
  createSalaryStructure,
  resolveStructure,
  type ResolvedSalaryStructure,
  type SalaryRule,
} from '@/modules/payroll-config'

export const JANUARY = Period.month(2026, 1)

export function employee(overrides: Partial<EmployeeSummary> = {}): EmployeeSummary {
  return {
    id: 'emp-1',
    name: 'Asha Menon',
    email: 'asha@example.com',
    departmentId: 'dept-1',
    departmentName: 'Engineering',
    jobPositionName: 'Engineer',
    employeeType: 'full_time',
    managerId: null,
    workingScheduleId: 'sched-1',
    bankAccount: 'HDFC-0001',
    isActive: true,
    ...overrides,
  }
}

export function contract(overrides: Partial<ContractSnapshot> = {}): ContractSnapshot {
  return {
    id: 'contract-1',
    employeeId: 'emp-1',
    wage: 50000,
    salaryStructureId: 'structure-1',
    workingScheduleId: 'sched-1',
    departmentId: 'dept-1',
    jobPositionName: 'Engineer',
    start: new Date(Date.UTC(2025, 0, 1)),
    end: null,
    ...overrides,
  }
}


export function standardStructure(): ResolvedSalaryStructure {
  const rules: SalaryRule[] = [
    createSalaryRule({
      id: 'r-basic',
      name: 'Basic',
      code: 'BASIC',
      category: 'basic',
      sequence: 10,
      
      
      computation: { type: 'formula', expression: 'WAGE * WORKED_RATIO' },
    }),
    createSalaryRule({
      id: 'r-hra',
      name: 'House Rent Allowance',
      code: 'HRA',
      category: 'allowance',
      sequence: 20,
      computation: { type: 'percentage', percent: 40, ofCode: 'BASIC' },
    }),
    createSalaryRule({
      id: 'r-gross',
      name: 'Gross',
      code: 'GROSS',
      category: 'gross',
      sequence: 30,
      computation: { type: 'formula', expression: 'BASIC + HRA' },
    }),
    createSalaryRule({
      id: 'r-pf',
      name: 'Provident Fund',
      code: 'PF',
      category: 'deduction',
      sequence: 40,
      computation: { type: 'percentage', percent: 12, ofCode: 'BASIC' },
    }),
    createSalaryRule({
      id: 'r-net',
      name: 'Net Salary',
      code: 'NET',
      category: 'net',
      sequence: 50,
      computation: { type: 'formula', expression: 'GROSS - PF' },
    }),
  ]

  const structure = createSalaryStructure({
    id: 'structure-1',
    name: 'Standard Monthly',
    code: 'STD_MONTHLY',
    rules: rules.map((r) => ({ ruleId: r.id, sequence: r.sequence })),
  })

  return resolveStructure(structure, new Map(rules.map((r) => [r.id, r])))
}
