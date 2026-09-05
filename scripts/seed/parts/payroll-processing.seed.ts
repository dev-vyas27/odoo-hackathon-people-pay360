/**
 * Four months of paid payruns, plus one draft.
 *
 * ── Dev C: this file is yours to replace (modules/payroll-processing). ──────
 *
 * The dashboard's Total Net Salary Paid, Average Salary, Salary Cost by
 * Department and Monthly Net Salary Trend all read `payslips`. With an empty
 * table every one of them is zero and the screen cannot be judged, so this
 * seeds the history the plan calls for: a fully paid history so the trend chart
 * has shape on first load, and a draft payrun staged for the live compute demo.
 *
 * It runs AFTER contracts, because a payslip records which contract it was
 * computed from.
 *
 * The amounts are produced by the same arithmetic the rule engine will use, in
 * the same sequence, so recomputing a seeded payslip should not move the
 * numbers. If it does, one of the two is wrong — which makes this a rough
 * conformance check as well as demo data.
 */
import { SEED, seedId } from '../ids'
import type { SeedPart, SeedRow } from '../types'
import { STRUCTURE_ID } from './payroll-config.seed'

/** Wage per employee — must match `employment.seed.ts`. */
const WAGES: Array<{ employeeId: string; wage: number }> = [
  { employeeId: SEED.employees.demoLead, wage: 90000 },
  { employeeId: SEED.employees.twoContracts, wage: 78000 },
  { employeeId: seedId('emp', 3), wage: 145000 },
  { employeeId: seedId('emp', 4), wage: 42000 },
  { employeeId: seedId('emp', 5), wage: 25000 },
]

/** The contract each employee is paid under, mirroring employment.seed.ts. */
const CONTRACTS: Record<string, string> = {
  [SEED.employees.demoLead]: seedId('con', 1),
  [SEED.employees.twoContracts]: seedId('con', 3),
  [seedId('emp', 3)]: seedId('con', 4),
  [seedId('emp', 4)]: seedId('con', 5),
  [seedId('emp', 5)]: seedId('con', 6),
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** The rule engine, in miniature. Sequence order matters; see the header. */
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

    /**
     * Four paid months ending with the CURRENT one, then a draft for next
     * month. The dashboard defaults to the current month, so it has to have
     * paid data — otherwise the demo opens on a screen of zeros.
     */
    for (let offset = 3; offset >= -1; offset -= 1) {
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1))
      const monthEnd = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      )
      const isDraft = offset === -1
      const payrunId = seedId('run', 4 - offset)

      payruns.push({
        id: payrunId,
        name: `${MONTHS[monthStart.getUTCMonth()]} ${monthStart.getUTCFullYear()} — Monthly`,
        salary_structure_id: STRUCTURE_ID,
        period_start: iso(monthStart),
        period_end: iso(monthEnd),
        status: isDraft ? 'draft' : 'paid',
      })

      for (const { employeeId, wage } of WAGES) {
        payrunEmployees.push([payrunId, employeeId])

        // A draft payrun has selected employees but NO payslips — they do not
        // exist until Compute runs, which is the live demo moment.
        if (isDraft) continue

        const computed = compute(wage)
        const payslipId = seedId('psl', payslipSeq)
        payslipSeq += 1

        payslips.push({
          id: payslipId,
          payrun_id: payrunId,
          employee_id: employeeId,
          contract_id: CONTRACTS[employeeId],
          period_start: iso(monthStart),
          period_end: iso(monthEnd),
          worked_days: 22,
          basic: computed.basic,
          gross: computed.gross,
          deductions: computed.deductions,
          net: computed.net,
          status: 'paid',
        })

        for (const line of computed.lines) {
          // Offset well clear of the payslip ids so the two never collide.
          lines.push({ id: seedId('psl', 1000 + lineSeq), payslip_id: payslipId, ...line })
          lineSeq += 1
        }
      }
    }

    ctx.log(`${await ctx.upsert('payruns', payruns)} payruns (4 paid, 1 draft)`)

    for (const [payrunId, employeeId] of payrunEmployees) {
      await ctx.sql(
        `INSERT INTO payrun_employees (payrun_id, employee_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [payrunId, employeeId],
      )
    }

    ctx.log(`${await ctx.upsert('payslips', payslips)} payslips`)
    ctx.log(`${await ctx.upsert('payslip_lines', lines)} payslip lines`)
  },
}
