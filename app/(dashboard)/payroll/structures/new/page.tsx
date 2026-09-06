import { redirect } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/modules/shared'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { InfoNote } from '../../_components/states'
import { load, pageActor } from '../../_lib/session'
import { StructureForm, emptyStructure } from '../structure-form'
import { loadAvailableRules } from '../available-rules'

export default async function NewSalaryStructurePage() {
  const actor = await pageActor()

  


  if (!can(actor.role, 'salary_structure', 'create')) redirect('/forbidden')
  const rules = await load(() => loadAvailableRules(actor))
  const available = rules.ok ? rules.data : []

  return (
    <>
      <PageHeader
        title="New salary structure"
        description="Choose the rules this structure runs, and the order they run in."
      />

      {available.length ? (
        <StructureForm structure={emptyStructure} available={available} />
      ) : (
        <InfoNote>
          <p className="font-medium">There are no active salary rules yet.</p>
          <p className="text-muted-foreground">
            A structure is a selection of rules, so create the rules first — BASIC, HRA and NET are
            enough to compute a payslip.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/payroll/rules/new">Create a salary rule</Link>
          </Button>
        </InfoNote>
      )}
    </>
  )
}
