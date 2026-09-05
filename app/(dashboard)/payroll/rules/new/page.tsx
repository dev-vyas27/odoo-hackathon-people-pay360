import { ListSalaryRulesUseCase, salaryRuleRepository } from '@/modules/payroll-config/server'
import { PageHeader } from '@/components/resource/page-header'
import { load, pageActor } from '../../_lib/session'
import { RuleForm, emptyRule } from '../rule-form'

export default async function NewSalaryRulePage() {
  const actor = await pageActor()

  // Existing codes are offered as the base of a percentage rule; failing to load
  // them costs an autocomplete, not the form.
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
