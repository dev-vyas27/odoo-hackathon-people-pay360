import { redirect } from 'next/navigation'
import { ListSalaryRulesUseCase, salaryRuleRepository } from '@/modules/payroll-config/server'
import { can } from '@/modules/shared'
import { PageHeader } from '@/components/resource/page-header'
import { load, pageActor } from '../../_lib/session'
import { RuleForm, emptyRule } from '../rule-form'

export default async function NewSalaryRulePage() {
  const actor = await pageActor()

  


  if (!can(actor.role, 'salary_rule', 'create')) redirect('/forbidden')

  
  
  const existing = await load(async () => {
    const outcome = await new ListSalaryRulesUseCase(salaryRuleRepository()).execute({
      actor,
      query: { limit: 200 },
    })
    return outcome.ok ? outcome.value.items.map((r) => r.code) : []
  })

  return (
    <>
      <PageHeader
        title="New salary rule"
        description="One rule computes one payslip line. Give it a code so later rules can reference it."
      />
      <RuleForm rule={emptyRule} availableCodes={existing.ok ? existing.data : []} />
    </>
  )
}
