


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

    


    await ctx.link(
      'salary_structure_rules',
      ['salary_structure_id', 'salary_rule_id'],
      Array.from({ length: 7 }, (_, i) => [STRUCTURE_ID, seedId('rul', i + 1)] as [string, string]),
    )
    ctx.log('1 salary structure with 7 rules in sequence')
  },
}
