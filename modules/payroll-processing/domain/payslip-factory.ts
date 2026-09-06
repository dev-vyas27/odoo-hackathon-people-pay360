


import { Money, type Period } from '@/modules/shared'
import { runRuleEngine, type ResolvedSalaryStructure } from '@/modules/payroll-config'
import type { Payslip } from './payslip'

export interface PayslipFactoryInput {
  id: string
  payrunId: string
  payrunName: string
  employeeId: string
  employeeName: string
  employeeEmail?: string | null
  departmentId: string | null
  
  contract: { id: string; wage: number }
  structure: ResolvedSalaryStructure
  period: Period
  
  workedDays: number
  workedUnits: number
  expectedUnits: number
}

export function createPayslip(input: PayslipFactoryInput): Payslip {
  const lines = runRuleEngine({
    rules: input.structure.rules,
    contractWage: Money.of(input.contract.wage),
    prorationRatio: prorationRatio(input.workedUnits, input.expectedUnits),
    workedDays: input.workedDays,
  })

  return {
    id: input.id,
    payrunId: input.payrunId,
    payrunName: input.payrunName,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeEmail: input.employeeEmail ?? null,
    departmentId: input.departmentId,
    contractId: input.contract.id,
    structureId: input.structure.id,
    structureName: input.structure.name,
    period: input.period,
    workedDays: input.workedDays,
    lines,
    status: 'computed',
  }
}



function prorationRatio(worked: number, expected: number): number {
  if (expected <= 0) return 1
  return worked / expected
}
