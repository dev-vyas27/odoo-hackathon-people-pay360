/**
 * The rules a structure may include, with their dependencies resolved.
 *
 * `dependenciesOf` is domain logic and is exported from payroll-config, so the
 * form's live ordering warnings and the server's own analysis agree about what
 * "this rule reads BASIC" means.
 */
import { dependenciesOf, type SalaryRule } from '@/modules/payroll-config'
import { ListSalaryRulesUseCase, salaryRuleRepository } from '@/modules/payroll-config/server'
import type { Actor } from '@/modules/shared'
import type { AvailableRule } from './structure-rules-field'

export async function loadAvailableRules(actor: Actor): Promise<AvailableRule[]> {
  const outcome = await new ListSalaryRulesUseCase(salaryRuleRepository()).execute({
    actor,
    query: { limit: 200, filters: { active: true } },
  })
  if (!outcome.ok) return []

  return outcome.value.items.map(toAvailableRule)
}

export function toAvailableRule(rule: SalaryRule): AvailableRule {
  return {
    id: rule.id,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    dependencies: dependenciesOf(rule),
  }
}
