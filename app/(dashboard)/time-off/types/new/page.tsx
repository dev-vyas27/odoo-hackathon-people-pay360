'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TimeOffTypeValues } from '@/modules/timeoff/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { TimeOffTypeForm } from '../../_components/time-off-type-form'

export default function NewTimeOffTypePage() {
  const router = useRouter()
  const create = useCreateResource<{ id: string }, TimeOffTypeValues>('time-off/types', {
    successMessage: 'Leave type created',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New leave type"
        description="Defines how every request of this type behaves: its unit, whether it consumes a balance, and how payroll treats it."
      />

      <TimeOffTypeForm
        submitLabel="Create type"
        defaultValues={{
          name: '',
          code: '',
          unit: 'day',
          requiresAllocation: true,
          isPaid: true,
          isActive: true,
        }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/time-off/types">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await create.mutateAsync(values)
          router.push('/time-off/types')
        }}
      />
    </div>
  )
}
