/**
 * Nine months of paid payruns across the whole workforce, plus one draft.
 *
 * The dashboard's Total Net Salary Paid, Average Salary, Salary Cost by
 * Department and Monthly Net Salary Trend all read `payslips`. With an empty
 * table every one of them is zero and the screen cannot be judged, so this
 * seeds the history: a fully paid run for each of the last nine months, and a
 * draft staged for the live compute demo.
 *
 * Nine and not four, because the trend chart plots twelve months. With four it
 * sat flat on zero for two thirds of its width and then leapt, which reads as a
 * company that started trading in June rather than as a trend. Nine fills the
 * chart, and people hired part-way through still join it late — so the line
 * rises for a real reason.
 *
 * ── The wage comes from the contract, not the employee ─────────────────────
 *
 * Every payslip resolves the contract that actually covered its period and uses
 * THAT contract's wage. One employee had a raise three months ago, so their
 * oldest payslip comes out lower than the other three — which is the whole
 * point of storing `contract_id` on a payslip, and is checkable on screen.
 *
 * The amounts are produced by the same arithmetic the rule engine uses, in the
 * same sequence, so recomputing a seeded payslip should not move the numbers.
 * If it does, one of the two is wrong — which makes this a rough conformance
 * check as well as demo data.
 */
import { seedId } from '../ids'
import { contractOn } from '../contracts'
import { ACTIVE_ROSTER } from '../roster'
import type { SeedPart, SeedRow } from '../types'
import { STRUCTURE_ID } from './payroll-config.seed'

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

/** Business days in a month, which is what `worked_days` means on a payslip. */
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

    /**
     * Paid months ending with the CURRENT one, then a draft for next month. The
     * dashboard defaults to the current month, so it has to have paid data —
     * otherwise the demo opens on a screen of zeros.
     */
    const PAID_MONTHS = 9
    for (let offset = PAID_MONTHS; offset >= -1; offset -= 1) {
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1))
      const monthEnd = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      )
      const isDraft = offset === -1
      // `seedId` rejects a negative index, so the draft (offset -1) has to
      // land above the paid runs rather than below them.
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
        /**
         * Only people whose contract covers the period. Someone hired last
         * month has no payslip for the month before that, which is both correct
         * and what makes the monthly trend rise rather than sit flat.
         */
        const contract = contractOn(person.id, iso(monthEnd))
        if (!contract) continue

        payrunEmployees.push([payrunId, person.id])

        // A draft payrun has selected employees but NO payslips — they do not
        // exist until Compute runs, which is the live demo moment.
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
          // Offset well clear of the payslip ids so the two never collide.
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
