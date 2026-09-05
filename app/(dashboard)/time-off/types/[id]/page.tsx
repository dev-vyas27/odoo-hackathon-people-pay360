'use client'

/**
 * Edit a leave type.
 *
 * Deleting is offered but usually refused: a type with allocations or requests
 * against it is history, and the use case says so in words rather than letting
 * a foreign key error surface as a 500. Deactivating is the real answer.
 */
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuArrowLeft, LuTrash2 } from 'react-icons/lu'
import type { TimeOffTypeValues, TimeOffTypeView } from '@/modules/timeoff/schemas'
import { useDeleteResource, useResourceList, useUpdateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeOffTypeForm } from '../../_components/time-off-type-form'

export default function EditTimeOffTypePage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a promise. `use()` unwraps it in a client component.
  const { id } = use(params)
  const router = useRouter()

  /**
   * Read from the list rather than a detail endpoint. There is no
   * `GET /types/[id]`: the list is a handful of rows, TanStack has usually
   * already cached it from the previous screen, and inventing an endpoint to
   * serve one row of it would be API surface nobody else needs.
   */
  const { page, isLoading } = useResourceList<TimeOffTypeView>('time-off/types', { limit: 100 })
  const type = page.items.find((item) => item.id === id)

  const update = useUpdateResource<TimeOffTypeView, TimeOffTypeValues>('time-off/types')
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
        submitLabel="Save changes"
        defaultValues={{
          name: type.name,
          code: type.code,
          unit: type.unit,
          requiresAllocation: type.requiresAllocation,
          isPaid: type.isPaid,
          isActive: type.isActive,
        }}
        cancel={
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
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
          router.push('/time-off/types')
        }}
      />
    </div>
  )
}
