'use client'



import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuArrowLeft, LuTrash2 } from 'react-icons/lu'
import type { TimeOffTypeValues, TimeOffTypeView } from '@/modules/timeoff/schemas'
import { useDeleteResource, useResourceList, useUpdateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { useCan } from '@/components/auth/current-user'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeOffTypeForm } from '../../_components/time-off-type-form'

export default function EditTimeOffTypePage({ params }: { params: Promise<{ id: string }> }) {
  
  const { id } = use(params)
  const router = useRouter()

  


  const { page, isLoading } = useResourceList<TimeOffTypeView>('time-off/types', { limit: 100 })
  const type = page.items.find((item) => item.id === id)

  const update = useUpdateResource<TimeOffTypeView, TimeOffTypeValues>('time-off/types')
  


  const canDelete = useCan('time_off_type', 'delete')
  const canEdit = useCan('time_off_type', 'update')

  const remove = useDeleteResource('time-off/types', { successMessage: 'Leave type deleted' })

  if (isLoading) return <Skeleton className="h-64 w-full max-w-3xl" />

  if (!type) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Not found" description="That leave type does not exist." />
        <Button variant="outline" asChild>
          <Link href="/time-off/types">Back to types</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={type.name}
        description={`Code ${type.code}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/time-off/types">
              <LuArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      <TimeOffTypeForm
        readOnly={!canEdit}
        submitLabel="Save changes"
        defaultValues={{
          name: type.name,
          code: type.code,
          unit: type.unit,
          requiresAllocation: type.requiresAllocation,
          autoApprove: type.autoApprove,
          isPaid: type.isPaid,
          isActive: type.isActive,
        }}
        cancel={
          canDelete ? (
            <ConfirmDialog
              title="Delete this leave type?"
              description="Only possible when nothing references it. Otherwise deactivate it instead — the history has to stay."
              confirmLabel="Delete"
              destructive
              onConfirm={async () => {
                await remove.mutateAsync(id)
                router.push('/time-off/types')
              }}
              trigger={
                <Button variant="ghost" type="button">
                  <LuTrash2 aria-hidden />
                  Delete
                </Button>
              }
            />
          ) : undefined
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
          router.push('/time-off/types')
        }}
      />
    </div>
  )
}
