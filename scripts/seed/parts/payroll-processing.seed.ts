


import { seedId } from '../ids'
import { contractOn } from '../contracts'
import { ACTIVE_ROSTER } from '../roster'
import type { SeedPart, SeedRow } from '../types'
import { STRUCTURE_ID } from './payroll-config.seed'

const round2 = (n: number) => Math.round(n * 100) / 100


function compute(wage: number) {
  const basic = round2(wage)
  const hra = round2(basic * 0.4)
  const ta = 1600
  const gross = round2(basic + hra + ta)
  const pf = round2(basic * 0.12)
  const tax = round2(gross * 0.1)
  const net = round2(gross - pf - tax)

  return {
    basic,
    gross,
    deductions: round2(pf + tax),
    net,
    lines: [
      { code: 'BASIC', name: 'Basic Salary', category: 'basic', sequence: 10, amount: basic },
      { code: 'HRA', name: 'House Rent Allowance', category: 'allowance', sequence: 20, amount: hra },
      { code: 'TA', name: 'Travel Allowance', category: 'allowance', sequence: 30, amount: ta },
      { code: 'GROSS', name: 'Gross Salary', category: 'gross', sequence: 40, amount: gross },
      { code: 'PF', name: 'Provident Fund', category: 'deduction', sequence: 50, amount: pf },
      { code: 'TAX', name: 'Income Tax', category: 'deduction', sequence: 60, amount: tax },
      { code: 'NET', name: 'Net Salary', category: 'net', sequence: 70, amount: net },
    ],
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const iso = (date: Date) => date.toISOString().slice(0, 10)


function businessDays(start: Date, end: Date): number {
  let count = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

export const payrollProcessingSeed: SeedPart = {
  name: 'payroll-processing',
  tables: ['payruns', 'payrun_employees', 'payslips', 'payslip_lines'],
  async run(ctx) {
    const today = new Date()

    const payruns: SeedRow[] = []
    const payrunEmployees: Array<[string, string]> = []
    const payslips: SeedRow[] = []
    const lines: SeedRow[] = []

    let payslipSeq = 1
    let lineSeq = 1
    let paidTotal = 0

    


    const PAID_MONTHS = 9
    for (let offset = PAID_MONTHS; offset >= -1; offset -= 1) {
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1))
      const monthEnd = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      )
      const isDraft = offset === -1
      
      
      const payrunId = seedId('run', PAID_MONTHS + 1 - offset)
      const workedDays = businessDays(monthStart, monthEnd)

      payruns.push({
        id: payrunId,
        name: `${MONTHS[monthStart.getUTCMonth()]} ${monthStart.getUTCFullYear()} — Monthly`,
        salary_structure_id: STRUCTURE_ID,
        period_start: iso(monthStart),
        period_end: iso(monthEnd),
        status: isDraft ? 'draft' : 'paid',
      })

      for (const person of ACTIVE_ROSTER) {
        


        const contract = contractOn(person.id, iso(monthEnd))
        if (!contract) continue

        payrunEmployees.push([payrunId, person.id])

        
        
        if (isDraft) continue

        const computed = compute(contract.wage)
        paidTotal += computed.net
        const payslipId = seedId('psl', payslipSeq)
        payslipSeq += 1

        payslips.push({
          id: payslipId,
          payrun_id: payrunId,
          employee_id: person.id,
          contract_id: contract.id,
          period_start: iso(monthStart),
          period_end: iso(monthEnd),
          worked_days: workedDays,
          basic: computed.basic,
          gross: computed.gross,
          deductions: computed.deductions,
          net: computed.net,
          status: 'paid',
        })

        for (const line of computed.lines) {
          
          lines.push({ id: seedId('psl', 1_000_000 + lineSeq), payslip_id: payslipId, ...line })
          lineSeq += 1
        }
      }
    }

    ctx.log(`${await ctx.upsert('payruns', payruns)} payruns (${PAID_MONTHS} paid, 1 draft)`)
    ctx.log(
      `${await ctx.link('payrun_employees', ['payrun_id', 'employee_id'], payrunEmployees)} payrun selections`,
    )
    ctx.log(`${await ctx.upsert('payslips', payslips)} payslips`)
    ctx.log(`${await ctx.upsert('payslip_lines', lines)} payslip lines`)
    ctx.log(`₹${Math.round(paidTotal).toLocaleString('en-IN')} net paid across ${PAID_MONTHS} months`)
  },
}
