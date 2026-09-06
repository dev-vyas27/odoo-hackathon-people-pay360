/**
 * The layout is asserted here WITHOUT generating a PDF — which is the whole
 * reason `PayslipDocument` exists as a separate thing from the renderer.
 */
import { describe, expect, it } from 'vitest'
import { amountInWords } from './money-words'
import {
  buildPayslipDocument,
  fileNameFor,
  maskAccount,
  storageKeyFor,
  type PayslipDocumentInput,
} from './payslip-document'

const COMPANY = {
  name: 'PeoplePay360',
  addressLines: ['4th Floor, Ashram Road', 'Ahmedabad 380009'],
  email: 'payroll@example.com',
}

/** Rahul Verma's August 2026 payslip, exactly as the screen shows it. */
function input(overrides: Partial<PayslipDocumentInput['payslip']> = {}): PayslipDocumentInput {
  return {
    payslip: {
      id: '70736c00-0000-4000-8000-00000000000e',
      payrunId: '72756e00-0000-4000-8000-000000000003',
      payrunName: 'August 2026 — Monthly',
      employeeId: '656d7000-0000-4000-8000-000000000004',
      employeeName: 'Rahul Verma',
      employeeEmail: 'rahul@example.com',
      structureName: 'Regular Salary',
      periodStart: new Date('2026-07-31T00:00:00Z'),
      periodEnd: new Date('2026-08-30T00:00:00Z'),
      workedDays: 22,
      status: 'paid',
      basic: 78000,
      gross: 110800,
      deductions: 20440,
      net: 90360,
      lines: [
        { code: 'BASIC', name: 'Basic Salary', category: 'basic', sequence: 10, amount: 78000 },
        { code: 'HRA', name: 'House Rent Allowance', category: 'allowance', sequence: 20, amount: 31200 },
        { code: 'TA', name: 'Travel Allowance', category: 'allowance', sequence: 30, amount: 1600 },
        { code: 'GROSS', name: 'Gross Salary', category: 'gross', sequence: 40, amount: 110800 },
        { code: 'PF', name: 'Provident Fund', category: 'deduction', sequence: 50, amount: 9360 },
        { code: 'TAX', name: 'Income Tax', category: 'deduction', sequence: 60, amount: 11080 },
        { code: 'NET', name: 'Net Salary', category: 'net', sequence: 70, amount: 90360 },
      ],
      ...overrides,
    },
    employee: {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      departmentName: 'Engineering',
      jobPositionName: 'Senior Engineer',
      employeeType: 'permanent',
      bankAccount: '123456789012',
    },
    company: COMPANY,
    generatedAt: new Date('2026-09-05T10:30:00Z'),
  }
}

describe('buildPayslipDocument', () => {
  it('splits earnings from deductions and keeps subtotals out of both', () => {
    const document = buildPayslipDocument(input())

    expect(document.earnings.map((l) => l.code)).toEqual(['BASIC', 'HRA', 'TA'])
    expect(document.deductions.map((l) => l.code)).toEqual(['PF', 'TAX'])

    /**
     * The regression this guards: GROSS and NET are subtotal rules. Printed
     * among the earnings they would make the column sum to ~2x the gross and
     * read as an arithmetic bug to anyone checking by hand.
     */
    const printed = [...document.earnings, ...document.deductions].map((l) => l.code)
    expect(printed).not.toContain('GROSS')
    expect(printed).not.toContain('NET')
  })

  it('sums allowances from the lines rather than trusting a stored total', () => {
    expect(buildPayslipDocument(input()).totals.allowances).toBe(32800)
  })

  it('marks deductions negative so the renderer can colour them', () => {
    const document = buildPayslipDocument(input())
    expect(document.deductions.every((line) => line.negative)).toBe(true)
    expect(document.earnings.every((line) => line.negative)).toBe(false)
  })

  it('orders lines by sequence regardless of the order they arrive in', () => {
    const shuffled = input()
    shuffled.payslip = {
      ...shuffled.payslip,
      lines: [...shuffled.payslip.lines].reverse(),
    }
    expect(buildPayslipDocument(shuffled).earnings.map((l) => l.sequence)).toEqual([10, 20, 30])
  })

  it('spells the net pay out for the amount-in-words line', () => {
    expect(buildPayslipDocument(input()).netInWords).toBe('Ninety Thousand Three Hundred Sixty Rupees Only')
  })

  it('degrades to placeholders when the employee lookup is not wired up', () => {
    const document = buildPayslipDocument({ ...input(), employee: null })

    const department = document.employeeFields.find((f) => f.label === 'Department')
    expect(department?.value).toBe('—')
    // Still a valid payslip: the money is what matters and it is all present.
    expect(document.totals.net).toBe(90360)
  })

  it('never prints a full bank account number', () => {
    const document = buildPayslipDocument(input())
    const bank = document.employeeFields.find((f) => f.label === 'Bank account')
    expect(bank?.value).not.toContain('123456789012')
    expect(bank?.value.endsWith('9012')).toBe(true)
  })
})

describe('maskAccount', () => {
  it('keeps the last four digits', () => {
    expect(maskAccount('123456789012')).toBe('••••••••9012')
  })

  it('says so when there is nothing on file', () => {
    expect(maskAccount(null)).toBe('Not on file')
  })

  it('leaves a very short value alone rather than masking it to nothing', () => {
    expect(maskAccount('9012')).toBe('9012')
  })
})

describe('storageKeyFor / fileNameFor', () => {
  it('derives the bucket key from ids alone, so nothing has to be stored', () => {
    expect(storageKeyFor('run-1', 'slip-2')).toBe('payslips/run-1/slip-2.pdf')
  })

  it('makes a filename safe for a downloads folder', () => {
    expect(fileNameFor('Rahul Verma', new Date('2026-08-30T00:00:00Z'))).toBe(
      'Payslip-Rahul-Verma-2026-08.pdf',
    )
  })

  it('survives names with punctuation', () => {
    expect(fileNameFor("D'Souza, Maria", new Date('2026-01-31T00:00:00Z'))).toBe(
      'Payslip-D-Souza-Maria-2026-01.pdf',
    )
  })
})

describe('amountInWords', () => {
  it('uses the Indian numbering system, not the western one', () => {
    // 1,23,45,678 — crore/lakh, never "twelve million".
    expect(amountInWords(12345678)).toBe(
      'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only',
    )
  })

  it('spells paise separately', () => {
    expect(amountInWords(1234.56)).toBe(
      'One Thousand Two Hundred Thirty Four Rupees and Fifty Six Paise Only',
    )
  })

  it('handles the irregular teens', () => {
    expect(amountInWords(15)).toBe('Fifteen Rupees Only')
    expect(amountInWords(19000)).toBe('Nineteen Thousand Rupees Only')
  })

  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Zero Rupees Only')
  })

  it('rounds before spelling so words and figures cannot disagree', () => {
    expect(amountInWords(99.999)).toBe('One Hundred Rupees Only')
  })
})
