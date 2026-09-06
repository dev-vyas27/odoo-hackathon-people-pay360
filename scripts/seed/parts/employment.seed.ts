/**
 * Contracts — one per person, plus the two histories the demo turns on.
 *
 * The plan itself is in `../contracts.ts`, shared with payroll processing so a
 * payslip records the contract that actually covered its period. What matters
 * here is only that the rows land, and that the two load-bearing cases survive:
 *
 *   - One employee has an EXPIRED contract and a current one at a higher wage.
 *     The oldest seeded payrun falls inside the old contract, so its payslip
 *     must come out at the old figure. That is period-based contract selection,
 *     proven rather than asserted.
 *   - Three contracts end inside the 60-day window, so the dashboard's contract
 *     attention panel has real work in it.
 *
 * The exclusion constraint in migration 0006 applies only to `status =
 * 'active'` rows, which is why an expired contract can sit under the same
 * employee without conflicting.
 */
import { CONTRACT_PLAN } from '../contracts'
import { STRUCTURE_ID } from './payroll-config.seed'
import type { SeedPart } from '../types'

export const employmentSeed: SeedPart = {
  name: 'employment',
  tables: ['contracts'],
  async run(ctx) {
    const contracts = await ctx.upsert(
      'contracts',
      CONTRACT_PLAN.map((contract) => ({
        id: contract.id,
        employee_id: contract.employeeId,
        wage: contract.wage,
        salary_structure_id: STRUCTURE_ID,
        working_schedule_id: contract.scheduleId,
        starts_on: contract.startsOn,
        ends_on: contract.endsOn,
        status: contract.status,
      })),
    )

    const active = CONTRACT_PLAN.filter((c) => c.status === 'active').length
    const endingSoon = CONTRACT_PLAN.filter((c) => c.status === 'active' && c.endsOn).length
    ctx.log(`${contracts} contracts (${active} active, ${endingSoon} ending inside the window)`)
  },
}
