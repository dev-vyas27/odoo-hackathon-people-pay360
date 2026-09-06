import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { PayrunsTable } from './payruns-table'

export default function PayrunsPage() {
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

      <PayrunsTable />
    </>
  )
}
