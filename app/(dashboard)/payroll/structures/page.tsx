'use client'

import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/auth/current-user'
import { StructuresTable } from './structures-table'

export default function SalaryStructuresPage() {
  // hr_payroll_user reads salary configuration; only a manager may change it.
  const canCreate = useCan('salary_structure', 'create')

  return (
    <>
      <PageHeader
        title="Salary Structures"
        description="An ordered set of salary rules. A payrun computes every payslip from the structure it was created with."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/payroll/structures/new">
                <LuPlus className="size-4" aria-hidden />
                New structure
              </Link>
            </Button>
          ) : null
        }
      />

      <StructuresTable />
    </>
  )
}
