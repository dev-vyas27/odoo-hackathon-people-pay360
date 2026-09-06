import { redirect } from 'next/navigation'
import { ListSalaryRulesUseCase, salaryRuleRepository } from '@/modules/payroll-config/server'
import { can } from '@/modules/shared'
import { PageHeader } from '@/components/resource/page-header'
import { load, pageActor } from '../../_lib/session'
import { RuleForm, emptyRule } from '../rule-form'

export default async function NewSalaryRulePage() {
  const actor = await pageActor()

  /**
   * `proxy.ts` guards this section on READ, which `hr_payroll_user` has — so a
   * read-only role can reach this URL directly. Without this they would be
   * handed a full form that answers 403 on submit. Redirecting matches what the
   * proxy does for a section they cannot open at all.
   */
  if (!can(actor.role, 'salary_rule', 'create')) redirect('/forbidden')

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
