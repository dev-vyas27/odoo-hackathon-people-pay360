import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { ListSalaryStructuresUseCase, salaryStructureRepository } from '@/modules/payroll-config/server'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '../_components/states'
import { load, pageActor } from '../_lib/session'
import { StructuresTable } from './structures-table'

export default async function SalaryStructuresPage() {
  const actor = await pageActor()

  const result = await load(async () => {
    const outcome = await new ListSalaryStructuresUseCase(salaryStructureRepository()).execute({
      actor,
      query: { limit: 100 },
    })
    if (!outcome.ok) throw outcome.error
    return outcome.value
  })

  return (
    <>
      <PageHeader
        title="Salary Structures"
        description="An ordered set of salary rules. A payrun computes every payslip from the structure it was created with."
        actions={
          <Button asChild>
            <Link href="/payroll/structures/new">
              <LuPlus className="size-4" aria-hidden />
              New structure
            </Link>
          </Button>
        }
      />

      {result.ok ? (
        <StructuresTable structures={result.data.items} />
      ) : (
        <ErrorState message={result.message} />
      )}
    </>
  )
}
