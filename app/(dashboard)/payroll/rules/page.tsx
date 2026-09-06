import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { ListSalaryRulesUseCase, salaryRuleRepository } from '@/modules/payroll-config/server'
import { can } from '@/modules/shared'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '../_components/states'
import { load, pageActor } from '../_lib/session'
import { RulesTable, type RuleRow } from './rules-table'

export default async function SalaryRulesPage() {
  const actor = await pageActor()
  // hr_payroll_user reads salary configuration; only a manager may change it.
  const canCreate = can(actor.role, 'salary_rule', 'create')

  const result = await load(async () => {
    const outcome = await new ListSalaryRulesUseCase(salaryRuleRepository()).execute({
      actor,
      query: { limit: 200 },
    })
    if (!outcome.ok) throw outcome.error
    return outcome.value
  })

  return (
    <>
      <PageHeader
        title="Salary Rules"
        description="The building blocks of a payslip. Each rule computes one line, and its code is how later rules refer to it."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/payroll/rules/new">
                <LuPlus className="size-4" aria-hidden />
                New rule
              </Link>
            </Button>
          ) : null
        }
      />

      {result.ok ? (
        <RulesTable rules={result.data.items.map(toRow)} />
      ) : (
        <ErrorState message={result.message} />
      )}
    </>
  )
}

function toRow(rule: {
  id: string
  name: string
  code: string
  category: string
  sequence: number
  computation: { type: string; amount?: number; percent?: number; ofCode?: string; expression?: string }
  active: boolean
}): RuleRow {
  return {
    id: rule.id,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    computation: describe(rule.computation),
    active: rule.active,
  }
}

/** One human-readable line describing how a rule computes its amount. */
function describe(computation: {
  type: string
  amount?: number
  percent?: number
  ofCode?: string
  expression?: string
}): string {
  switch (computation.type) {
    case 'percentage':
      return `${computation.percent}% of ${computation.ofCode}`
    case 'formula':
      return computation.expression ?? ''
    default:
      return `Fixed ${computation.amount}`
  }
}
