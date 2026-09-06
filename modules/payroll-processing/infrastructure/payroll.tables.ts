


import type { PayrunStatus, PayslipStatus, SalaryCategory } from '@/modules/shared'

export const PAYRUNS_TABLE = 'payruns'
export const PAYRUN_EMPLOYEES_TABLE = 'payrun_employees'
export const PAYSLIPS_TABLE = 'payslips'
export const PAYSLIP_LINES_TABLE = 'payslip_lines'

export interface PayrunRow {
  id: string
  name: string
  salary_structure_id: string
  period_start: Date
  period_end: Date
  status: PayrunStatus
  created_at: Date
  updated_at: Date
}

export const PAYRUN_COLUMNS = [
  'id',
  'name',
  'salary_structure_id',
  'period_start',
  'period_end',
  'status',
  'created_at',
  'updated_at',
] as const


export interface PayrunReadRow extends PayrunRow {
  structure_name: string
  employee_ids: string[] | null
}

export interface PayslipRow {
  id: string
  payrun_id: string
  employee_id: string
  contract_id: string | null
  period_start: Date
  period_end: Date
  worked_days: number
  basic: number
  gross: number
  deductions: number
  net: number
  status: PayslipStatus
  created_at: Date
  updated_at: Date
}

export const PAYSLIP_COLUMNS = [
  'id',
  'payrun_id',
  'employee_id',
  'contract_id',
  'period_start',
  'period_end',
  'worked_days',
  'basic',
  'gross',
  'deductions',
  'net',
  'status',
  'created_at',
  'updated_at',
] as const



export interface PayslipReadRow extends PayslipRow {
  employee_name: string
  employee_email: string | null
  department_id: string | null
  payrun_name: string
  salary_structure_id: string
  structure_name: string
  lines: PayslipLineJson[] | null
}

export interface PayslipLineJson {
  code: string
  name: string
  category: SalaryCategory
  sequence: number
  amount: number | string
}
