'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { CreateContractBody } from '@/modules/employment/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ContractForm } from '../_components/contract-form'

export default function NewContractPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Arriving from an employee's smart button pre-selects them.
  const employeeId = searchParams.get('employeeId') ?? ''

  const create = useCreateResource<{ id: string }, CreateContractBody>('contracts', {
    successMessage: 'Contract created',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New contract"
        description="Overlapping contracts for the same employee are rejected — end the current one before starting the next."
      />

      <ContractForm
        submitLabel="Create contract"
        defaultValues={{
          employeeId,
          wage: 0,
          start: new Date(),
          end: null,
          workingScheduleId: undefined,
          salaryStructureId: undefined,
        }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/contracts">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await create.mutateAsync(values)
          router.push(employeeId ? `/contracts?employeeId=${employeeId}` : '/contracts')
        }}
      />
    </div>
  )
}
