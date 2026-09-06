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

  /**
   * `proxy.ts` guards this section on READ, which `hr_payroll_user` has — so a
   * read-only role can reach this URL directly. Without this they would be
   * handed a full form that answers 403 on submit. Redirecting matches what the
   * proxy does for a section they cannot open at all.
   */
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
