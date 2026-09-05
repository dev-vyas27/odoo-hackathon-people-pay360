/**
 * Salary rules and the structure that orders them.
 *
 * ── Dev C: this file is yours to replace (modules/payroll-config). ──────────
 *
 * It runs BEFORE contracts, because a contract names the salary structure it is
 * paid under. The rules are the spec's worked example (section 6), sequenced so
 * each can reference the codes that ran before it:
 *
 *   10 BASIC  fixed        contract wage
 *   20 HRA    percentage   40% of BASIC
 *   30 TA     fixed        1600
 *   40 GROSS  formula      BASIC + HRA + TA
 *   50 PF     percentage   12% of BASIC        (deduction)
 *   60 TAX    formula      10% of GROSS        (deduction)
 *   70 NET    formula      GROSS - PF - TAX
 */
import { seedId } from '../ids'
import type { SeedPart } from '../types'

export const STRUCTURE_ID = seedId('str', 1)

export const payrollConfigSeed: SeedPart = {
  name: 'payroll-config',
  tables: ['salary_rules', 'salary_structures', 'salary_structure_rules'],
  async run(ctx) {
    const rules = await ctx.upsert('salary_rules', [
      { id: seedId('rul', 1), name: 'Basic Salary', code: 'BASIC', category: 'basic', sequence: 10, computation_type: 'fixed', amount: 0, percentage: null, base_rule_code: null, expression: null, is_active: true },
      { id: seedId('rul', 2), name: 'House Rent Allowance', code: 'HRA', category: 'allowance', sequence: 20, computation_type: 'percentage', amount: null, percentage: 40, base_rule_code: 'BASIC', expression: null, is_active: true },
      { id: seedId('rul', 3), name: 'Travel Allowance', code: 'TA', category: 'allowance', sequence: 30, computation_type: 'fixed', amount: 1600, percentage: null, base_rule_code: null, expression: null, is_active: true },
      { id: seedId('rul', 4), name: 'Gross Salary', code: 'GROSS', category: 'gross', sequence: 40, computation_type: 'formula', amount: null, percentage: null, base_rule_code: null, expression: 'BASIC + HRA + TA', is_active: true },
      { id: seedId('rul', 5), name: 'Provident Fund', code: 'PF', category: 'deduction', sequence: 50, computation_type: 'percentage', amount: null, percentage: 12, base_rule_code: 'BASIC', expression: null, is_active: true },
      { id: seedId('rul', 6), name: 'Income Tax', code: 'TAX', category: 'deduction', sequence: 60, computation_type: 'formula', amount: null, percentage: null, base_rule_code: null, expression: 'GROSS * 0.1', is_active: true },
      { id: seedId('rul', 7), name: 'Net Salary', code: 'NET', category: 'net', sequence: 70, computation_type: 'formula', amount: null, percentage: null, base_rule_code: null, expression: 'GROSS - PF - TAX', is_active: true },
    ])
    ctx.log(`${rules} salary rules`)

    await ctx.upsert('salary_structures', [
      { id: STRUCTURE_ID, name: 'Regular Salary', code: 'REG', is_active: true },
    ])

    /**
     * The join table has a composite primary key and no `id`, so it cannot go
     * through `ctx.upsert` — that helper keys on `id`. This is what `ctx.sql`
     * exists for.
     */
    for (let i = 1; i <= 7; i += 1) {
      await ctx.sql(
        `INSERT INTO salary_structure_rules (salary_structure_id, salary_rule_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [STRUCTURE_ID, seedId('rul', i)],
      )
    }
    ctx.log('1 salary structure with 7 rules in sequence')
  },
}
