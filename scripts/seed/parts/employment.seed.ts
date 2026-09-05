/**
 * Contracts.
 *
 * ── Dev B: this file is yours to replace. ───────────────────────────────────
 *
 * It exists so the dashboard has contract data to aggregate and so payslips
 * have something to reference. Two rows are load-bearing for the demo:
 *
 *   - Rahul Verma has an EXPIRED contract and a current one. That pair is what
 *     proves period-based contract selection: payroll for a month inside the
 *     old contract must use the old wage.
 *   - Vikram Desai's contract ends inside the warning window, so spec B9's
 *     "contract attention items" alert has something real to surface.
 *
 * The exclusion constraint in migration 0006 only applies to `status = 'active'`
 * rows, which is why the expired contract can overlap nothing and still sit in
 * the same table.
 */
import { SEED, seedId } from '../ids'
import type { SeedPart } from '../types'

const iso = (date: Date) => date.toISOString().slice(0, 10)

export const employmentSeed: SeedPart = {
  name: 'employment',
  tables: ['contracts'],
  async run(ctx) {
    const today = new Date()
    const year = today.getUTCFullYear()

    /** Ends inside the 60-day attention window, so the alert fires. */
    const endingSoon = new Date(Date.UTC(year, today.getUTCMonth(), today.getUTCDate() + 30))

    const contracts = await ctx.upsert('contracts', [
      {
        id: seedId('con', 1),
        employee_id: SEED.employees.demoLead,
        wage: 90000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.standard40,
        starts_on: `${year - 1}-04-01`,
        ends_on: null,
        status: 'active',
      },
      {
        // Rahul, contract 1 of 2: the historical one. Lower wage on purpose —
        // a payslip for a month it covers must not use the current figure.
        id: seedId('con', 2),
        employee_id: SEED.employees.twoContracts,
        wage: 62000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.standard40,
        starts_on: `${year - 1}-01-01`,
        ends_on: `${year - 1}-12-31`,
        status: 'expired',
      },
      {
        // Rahul, contract 2 of 2: the current one.
        id: seedId('con', 3),
        employee_id: SEED.employees.twoContracts,
        wage: 78000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.standard40,
        starts_on: `${year}-01-01`,
        ends_on: null,
        status: 'active',
      },
      {
        id: seedId('con', 4),
        employee_id: seedId('emp', 3),
        wage: 145000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.standard40,
        starts_on: `${year - 2}-06-01`,
        ends_on: null,
        status: 'active',
      },
      {
        id: seedId('con', 5),
        employee_id: seedId('emp', 4),
        wage: 42000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.partTime20,
        starts_on: `${year}-02-01`,
        ends_on: null,
        status: 'active',
      },
      {
        // The one that triggers the contract-attention alert.
        id: seedId('con', 6),
        employee_id: seedId('emp', 5),
        wage: 25000,
        salary_structure_id: seedId('str', 1),
        working_schedule_id: SEED.schedules.standard40,
        starts_on: `${year}-01-15`,
        ends_on: iso(endingSoon),
        status: 'active',
      },
    ])

    ctx.log(`${contracts} contracts (one employee has an expired plus a current one)`)
  },
}
