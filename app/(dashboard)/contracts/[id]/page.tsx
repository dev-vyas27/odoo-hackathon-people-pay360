'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ContractListItem, CreateContractBody } from '@/modules/employment/schemas'
import { useResourceItem, useUpdateResource, useDeleteResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContractForm } from '../_components/contract-form'
import { formatDateRange, isCurrentContract } from '../../_components/format'

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: contract, isLoading } = useResourceItem<ContractListItem>('contracts', id)
  const update = useUpdateResource<ContractListItem, CreateContractBody>('contracts', {
    successMessage: 'Contract updated',
  })
  const remove = useDeleteResource('contracts', { successMessage: 'Contract deleted' })

  if (isLoading || !contract) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Contract"
        description={formatDateRange(contract.start, contract.end)}
        actions={
          <>
            <StatusBadge
              status={isCurrentContract(contract.start, contract.end) ? 'active' : 'expired'}
            />
            <ConfirmDialog
              title="Delete this contract?"
              description="History is the point of keeping contracts. Delete only a record created in error — to end employment, set an end date instead."
              confirmLabel="Delete"
              destructive
              trigger={<Button variant="outline">Delete</Button>}
              onConfirm={async () => {
                await remove.mutateAsync(id)
                router.push('/contracts')
              }}
            />
          </>
        }
      />

      <ContractForm
        employeeLocked
        submitLabel="Save changes"
        defaultValues={{
          employeeId: contract.employeeId,
          wage: contract.wage,
          start: new Date(contract.start),
          end: contract.end ? new Date(contract.end) : null,
          workingScheduleId: contract.workingScheduleId ?? undefined,
          salaryStructureId: contract.salaryStructureId ?? undefined,
        }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/contracts">Back to list</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
        }}
      />
    </div>
  )
}
