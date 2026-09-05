import { can, Money } from '@/modules/shared'
import { runRuleEngine, type SalaryStructureFormValues } from '@/modules/payroll-config'
import {
  GetSalaryStructureDetailUseCase,
  salaryRuleRepository,
  salaryStructureRepository,
} from '@/modules/payroll-config/server'
import { PageHeader } from '@/components/resource/page-header'
import { ErrorState, WarningNote } from '../../_components/states'
import { load, pageActor } from '../../_lib/session'
import { StructureForm } from '../structure-form'
import { loadAvailableRules, toAvailableRule } from '../available-rules'
import { StructurePreview, type PreviewLine } from './structure-preview'

export default async function EditSalaryStructurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await pageActor()

  const result = await load(async () => {
    const detail = await new GetSalaryStructureDetailUseCase(
      salaryStructureRepository(),
      salaryRuleRepository(),
    ).execute({ actor, id })
    if (!detail.ok) throw detail.error

    return { detail: detail.value, available: await loadAvailableRules(actor) }
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Salary structure" />
        <ErrorState title="Could not open this structure" message={result.message} />
      </>
    )
  }

  const { detail, available } = result.data
  const { structure, rules, issues } = detail

  const values: SalaryStructureFormValues = {
    name: structure.name,
    code: structure.code,
    active: structure.active,
    rules: structure.rules.map((r) => ({ ruleId: r.ruleId, sequence: r.sequence })),
  }

  // Rules included here but archived elsewhere still have to be selectable, or
  // opening the form would silently drop them.
  const options = mergeById(available, rules.map((r) => toAvailableRule(r.rule)))

  return (
    <>
      <PageHeader
        title={structure.name}
        description={`${rules.length} rule${rules.length === 1 ? '' : 's'}${structure.active ? '' : ' · archived'}`}
      />

      {issues.length ? (
        <WarningNote className="mb-6">
          <p className="font-medium">This structure will not compute as it stands.</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {issues.map((issue) => (
              <li key={`${issue.ruleCode}-${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
        </WarningNote>
      ) : null}

      <StructurePreview lines={preview(rules)} />

      <div className="mt-8">
        <StructureForm
          structure={values}
          structureId={structure.id}
          available={options}
          // hr_payroll_user reads salary configuration; only a manager edits it.
          readOnly={!can(actor.role, 'salary_structure', 'update')}
        />
      </div>
    </>
  )
}

/**
 * What this structure produces for a sample wage.
 *
 * Runs the REAL engine, not an illustration: editing a rule and reloading shows
 * the numbers move, which is the whole point of the configuration screens being
 * functional rather than decorative.
 */
const SAMPLE_WAGE = 50000

function preview(rules: Array<{ rule: { code: string; name: string; category: string }; sequence: number }>): PreviewLine[] | null {
  try {
    return runRuleEngine({
      rules: rules as never,
      contractWage: Money.of(SAMPLE_WAGE),
      prorationRatio: 1,
    }).map((line) => ({
      code: line.code,
      name: line.name,
      category: line.category,
      sequence: line.sequence,
      amount: line.amount.toNumber(),
    }))
  } catch {
    // A broken structure is already explained by the issues panel above.
    return null
  }
}

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const byId = new Map(primary.map((item) => [item.id, item]))
  for (const item of extra) if (!byId.has(item.id)) byId.set(item.id, item)
  return [...byId.values()]
}
