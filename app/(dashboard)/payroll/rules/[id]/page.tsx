import { toSalaryRuleFormValues } from '@/modules/payroll-config'
import {
  GetSalaryRuleUseCase,
  ListSalaryRulesUseCase,
  salaryRuleRepository,
} from '@/modules/payroll-config/server'
import { PageHeader } from '@/components/resource/page-header'
import { ErrorState } from '../../_components/states'
import { load, pageActor } from '../../_lib/session'
import { RuleForm } from '../rule-form'
import { ArchiveRuleButton } from './archive-rule-button'

export default async function EditSalaryRulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Next 16: params is a promise and must be awaited.
  const { id } = await params
  const actor = await pageActor()

  const result = await load(async () => {
    const repository = salaryRuleRepository()

    const rule = await new GetSalaryRuleUseCase(repository).execute({ actor, id })
    if (!rule.ok) throw rule.error

    const others = await new ListSalaryRulesUseCase(repository).execute({
      actor,
      query: { limit: 200 },
    })

    return {
      rule: rule.value,
      availableCodes: others.ok
        ? others.value.items.filter((r) => r.id !== id).map((r) => r.code)
        : [],
    }
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Salary rule" />
        <ErrorState title="Could not open this rule" message={result.message} />
      </>
    )
  }

  const { rule, availableCodes } = result.data

  return (
    <>
      <PageHeader
        title={rule.name}
        description={`Code ${rule.code} · runs at sequence ${rule.sequence}`}
        actions={<ArchiveRuleButton id={rule.id} name={rule.name} active={rule.active} />}
      />
      <RuleForm
        rule={toSalaryRuleFormValues(rule)}
        ruleId={rule.id}
        availableCodes={availableCodes}
      />
    </>
  )
}
