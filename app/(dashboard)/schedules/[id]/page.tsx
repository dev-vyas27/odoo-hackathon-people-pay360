'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CreateScheduleBody, ScheduleListItem } from '@/modules/employment/schemas'
import { useResourceItem, useUpdateResource, useDeleteResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScheduleForm } from '../_components/schedule-form'

export default function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: schedule, isLoading } = useResourceItem<ScheduleListItem>('schedules', id)
  const update = useUpdateResource<ScheduleListItem, CreateScheduleBody>('schedules', {
    successMessage: 'Schedule updated',
  })
  const remove = useDeleteResource('schedules', { successMessage: 'Schedule deleted' })

  if (isLoading || !schedule) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={schedule.name}
        description={`${schedule.weeklyHours.toFixed(2)} hours per week`}
        actions={
          <ConfirmDialog
            title="Delete this schedule?"
            description="Employees and contracts pointing at it will be left without a schedule, and attendance can no longer judge lateness or overtime for them."
            confirmLabel="Delete"
            destructive
            trigger={<Button variant="outline">Delete</Button>}
            onConfirm={async () => {
              await remove.mutateAsync(id)
              router.push('/schedules')
            }}
          />
        }
      />

      <ScheduleForm
        submitLabel="Save changes"
        defaultValues={{ name: schedule.name, days: schedule.days }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/schedules">Back to list</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
        }}
      />
    </div>
  )
}
