import Link from 'next/link'
import { ListSalaryStructuresUseCase, salaryStructureRepository } from '@/modules/payroll-config/server'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState, InfoNote } from '../../_components/states'
import { load, pageActor } from '../../_lib/session'
import { PayrunWizard } from './payrun-wizard'

export default async function NewPayrunPage() {
  const actor = await pageActor()

  const result = await load(async () => {
    const outcome = await new ListSalaryStructuresUseCase(salaryStructureRepository()).execute({
      actor,
      query: { limit: 100, filters: { active: true } },
    })
    if (!outcome.ok) throw outcome.error
    return outcome.value.items.filter((s) => s.ruleCount > 0)
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="New pay run" />
        <ErrorState message={result.message} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New pay run"
        description="Choose the scope, then pick exactly who is included. Nothing is saved until the final step."
      />

      {result.data.length ? (
        <PayrunWizard
          structures={result.data.map((s) => ({ id: s.id, name: s.name, ruleCount: s.ruleCount }))}
        />
      ) : (
        <InfoNote>
          <p className="font-medium">There is no salary structure with rules yet.</p>
          <p className="text-muted-foreground">
            A pay run computes every payslip from a structure, so one has to exist first.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/payroll/structures/new">Create a salary structure</Link>
          </Button>
        </InfoNote>
      )}
    </>
  )
}
