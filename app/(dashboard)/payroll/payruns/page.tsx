import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { toPayrunView } from '@/modules/payroll-processing'
import { ListPayrunsUseCase, payrunRepository } from '@/modules/payroll-processing/server'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ErrorState } from '../_components/states'
import { load, pageActor } from '../_lib/session'
import { PayrunsTable } from './payruns-table'

export default async function PayrunsPage() {
  const actor = await pageActor()

  const result = await load(async () => {
    const outcome = await new ListPayrunsUseCase(payrunRepository()).execute({
      actor,
      query: { limit: 50 },
    })
    if (!outcome.ok) throw outcome.error
    return outcome.value.items.map(toPayrunView)
  })

  return (
    <>
      <PageHeader
        title="Pay Runs"
        description="A batch of payslips for one salary structure and one period. Finalised runs are kept as history."
        actions={
          <Button asChild>
            <Link href="/payroll/payruns/new">
              <LuPlus className="size-4" aria-hidden />
              New pay run
            </Link>
          </Button>
        }
      />

      {result.ok ? <PayrunsTable payruns={result.data} /> : <ErrorState message={result.message} />}
    </>
  )
}
