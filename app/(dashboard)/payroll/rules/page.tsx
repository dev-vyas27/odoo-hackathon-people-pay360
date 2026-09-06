'use client'

import Link from 'next/link'
import { LuPlus } from 'react-icons/lu'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { useCan } from '@/components/auth/current-user'
import { RulesTable } from './rules-table'

export default function SalaryRulesPage() {
  // hr_payroll_user reads salary configuration; only a manager may change it.
  const canCreate = useCan('salary_rule', 'create')

  return (
    <>
      <PageHeader
        title="Salary Rules"
        description="The building blocks of a payslip. Each rule computes one line, and its code is how later rules refer to it."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/payroll/rules/new">
                <LuPlus className="size-4" aria-hidden />
                New rule
              </Link>
            </Button>
          ) : null
        }
      />

      <RulesTable />
    </>
  )
}
