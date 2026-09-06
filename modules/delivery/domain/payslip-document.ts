




export interface PayslipDocumentInput {
  payslip: {
    id: string
    payrunId: string
    payrunName: string
    employeeId: string
    employeeName: string
    employeeEmail?: string | null
    structureName: string
    periodStart: Date
    periodEnd: Date
    workedDays: number
    status: string
    basic: number
    gross: number
    deductions: number
    net: number
    lines: ReadonlyArray<{
      code: string
      name: string
      category: string
      sequence: number
      amount: number
    }>
  }
  
  employee?: {
    name: string
    email: string
    departmentName: string | null
    jobPositionName: string | null
    employeeType: string
    bankAccount: string | null
  } | null
  company: CompanyIdentity
  generatedAt: Date
}

export interface CompanyIdentity {
  name: string
  addressLines: readonly string[]
  email: string | null
}

export interface DocumentField {
  label: string
  value: string
}

export interface DocumentLine {
  sequence: number
  code: string
  name: string
  category: string
  amount: number
  
  negative: boolean
}

export interface DocumentTotals {
  basic: number
  allowances: number
  gross: number
  deductions: number
  net: number
}

export interface PayslipDocument {
  
  title: string
  subtitle: string
  company: CompanyIdentity
  employeeName: string
  employeeFields: DocumentField[]
  payrunFields: DocumentField[]
  statusLabel: string
  earnings: DocumentLine[]
  deductions: DocumentLine[]
  
  totals: DocumentTotals
  netInWords: string
  footerNote: string
  generatedLabel: string
  
  fileName: string
  
  storageKey: string
}

import { amountInWords } from './money-words'



export function storageKeyFor(payrunId: string, payslipId: string): string {
  return `payslips/${payrunId}/${payslipId}.pdf`
}


export function fileNameFor(employeeName: string, periodEnd: Date): string {
  const safeName = employeeName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const month = `${periodEnd.getUTCFullYear()}-${String(periodEnd.getUTCMonth() + 1).padStart(2, '0')}`
  return `Payslip-${safeName || 'Employee'}-${month}.pdf`
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const MONTH = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const STAMP = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

export function formatDay(date: Date): string {
  return DAY.format(date)
}



export function maskAccount(account: string | null): string {
  if (!account) return 'Not on file'
  const trimmed = account.trim()
  if (trimmed.length <= 4) return trimmed
  return `${'•'.repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}



function splitLines(lines: PayslipDocumentInput['payslip']['lines']): {
  earnings: DocumentLine[]
  deductions: DocumentLine[]
} {
  const earnings: DocumentLine[] = []
  const deductions: DocumentLine[] = []

  for (const line of [...lines].sort((a, b) => a.sequence - b.sequence)) {
    const entry: DocumentLine = {
      sequence: line.sequence,
      code: line.code,
      name: line.name,
      category: titleCase(line.category),
      amount: line.amount,
      negative: line.category === 'deduction',
    }

    if (line.category === 'deduction') deductions.push(entry)
    else if (line.category === 'basic' || line.category === 'allowance') earnings.push(entry)
    
  }

  return { earnings, deductions }
}

export function buildPayslipDocument(input: PayslipDocumentInput): PayslipDocument {
  const { payslip, employee, company, generatedAt } = input
  const { earnings, deductions } = splitLines(payslip.lines)

  const allowances = earnings
    .filter((line) => line.category === 'Allowance')
    .reduce((sum, line) => sum + line.amount, 0)

  return {
    title: 'Payslip',
    subtitle: MONTH.format(payslip.periodEnd),
    company,
    employeeName: payslip.employeeName,

    employeeFields: [
      { label: 'Employee', value: payslip.employeeName },
      {
        label: 'Employee ID',
        
        
        value: payslip.employeeId.split('-')[0].toUpperCase(),
      },
      { label: 'Department', value: employee?.departmentName ?? '—' },
      { label: 'Designation', value: employee?.jobPositionName ?? '—' },
      { label: 'Employment type', value: titleCase(employee?.employeeType ?? '—') },
      { label: 'Bank account', value: maskAccount(employee?.bankAccount ?? null) },
    ],

    payrunFields: [
      { label: 'Pay run', value: payslip.payrunName },
      { label: 'Salary structure', value: payslip.structureName },
      {
        label: 'Pay period',
        value: `${formatDay(payslip.periodStart)} — ${formatDay(payslip.periodEnd)}`,
      },
      { label: 'Days worked', value: String(payslip.workedDays) },
      { label: 'Email', value: employee?.email ?? payslip.employeeEmail ?? '—' },
      { label: 'Payslip ID', value: payslip.id.split('-')[0].toUpperCase() },
    ],

    statusLabel: titleCase(payslip.status),
    earnings,
    deductions,

    totals: {
      basic: payslip.basic,
      allowances,
      gross: payslip.gross,
      deductions: payslip.deductions,
      net: payslip.net,
    },

    netInWords: amountInWords(payslip.net),
    footerNote:
      'This is a computer-generated payslip and does not require a signature. Figures are final for the period shown; corrections are issued as a separate pay run.',
    generatedLabel: `Generated ${STAMP.format(generatedAt)} UTC`,
    fileName: fileNameFor(payslip.employeeName, payslip.periodEnd),
    storageKey: storageKeyFor(payslip.payrunId, payslip.id),
  }
}
