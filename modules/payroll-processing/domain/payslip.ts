


import { Money, type PayslipStatus, type Period } from '@/modules/shared'
import { totalForCategory, type ComputedLine } from '@/modules/payroll-config'

export type { PayslipStatus }



export interface Payslip {
  readonly id: string
  readonly payrunId: string
  readonly payrunName: string
  readonly employeeId: string
  readonly employeeName: string
  readonly employeeEmail: string | null
  readonly departmentId: string | null
  
  readonly contractId: string | null
  readonly structureId: string
  readonly structureName: string
  readonly period: Period
  readonly workedDays: number
  readonly lines: readonly ComputedLine[]
  readonly status: PayslipStatus
}

export interface PayslipTotals {
  readonly basic: Money
  readonly allowances: Money
  readonly gross: Money
  readonly deductions: Money
  readonly net: Money
}



export function totalsOf(payslip: Payslip): PayslipTotals {
  return {
    basic: totalForCategory(payslip.lines, 'basic'),
    allowances: totalForCategory(payslip.lines, 'allowance'),
    gross: totalForCategory(payslip.lines, 'gross'),
    deductions: totalForCategory(payslip.lines, 'deduction'),
    net: totalForCategory(payslip.lines, 'net'),
  }
}


export function linesInSequence(payslip: Payslip): ComputedLine[] {
  return [...payslip.lines].sort((a, b) => a.sequence - b.sequence)
}

export function withStatus(payslip: Payslip, status: PayslipStatus): Payslip {
  return { ...payslip, status }
}
