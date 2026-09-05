'use client'

/**
 * The Attendance form (spec B3): "supports manual corrections restricted to
 * authorized users."
 *
 * `canCorrect` arrives as a prop from the server page, which is where the actor
 * actually lives — the same shape the dashboard layout uses for TopNav. Hiding
 * the form is a courtesy, never the control: CorrectAttendanceUseCase checks
 * the permission again, so a hand-crafted PATCH is refused regardless.
 */
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuTriangleAlert } from 'react-icons/lu'
import {
  correctAttendanceSchema,
  type AttendanceListItem,
  type CorrectAttendanceBody,
} from '@/modules/attendance/schemas'
import { useResourceItem, useUpdateResource, useDeleteResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatHours, formatTime } from '../../_components/format'

export function AttendanceDetail({ id, canCorrect }: { id: string; canCorrect: boolean }) {
  const router = useRouter()

  const { data: record, isLoading } = useResourceItem<AttendanceListItem>('attendance', id)
  const update = useUpdateResource<AttendanceListItem, CorrectAttendanceBody>('attendance', {
    successMessage: 'Attendance corrected',
  })
  const remove = useDeleteResource('attendance', { successMessage: 'Attendance deleted' })

  if (isLoading || !record) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Attendance — ${formatDate(record.checkIn)}`}
        description={`Worked ${formatHours(record.workedHours)}`}
        actions={
          <>
            <StatusBadge status={record.status} />
            {canCorrect ? (
              <ConfirmDialog
                title="Delete this attendance record?"
                description="It disappears from reporting and from the worked days a payslip is based on."
                confirmLabel="Delete"
                destructive
                trigger={<Button variant="outline">Delete</Button>}
                onConfirm={async () => {
                  await remove.mutateAsync(id)
                  router.push('/attendance')
                }}
              />
            ) : null}
          </>
        }
      />

      {record.manual ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-sm text-warning-foreground">
            This record was corrected manually. It stays flagged so the dashboard can report on
            data quality.
          </p>
        </div>
      ) : null}

      {canCorrect ? (
        <ResourceForm<CorrectAttendanceBody>
          schema={correctAttendanceSchema}
          submitLabel="Save correction"
          defaultValues={{
            checkIn: record.checkIn ? new Date(record.checkIn) : undefined,
            checkOut: record.checkOut ? new Date(record.checkOut) : null,
            breakMinutes: record.breakMinutes,
          }}
          cancel={
            <Button variant="ghost" asChild>
              <Link href="/attendance">Back to list</Link>
            </Button>
          }
          onSubmit={async (values) => {
            await update.mutateAsync({ id, values })
          }}
          fields={[
            { name: 'checkIn', label: 'Check in', type: 'date' },
            { name: 'checkOut', label: 'Check out', type: 'date' },
            {
              name: 'breakMinutes',
              label: 'Break (minutes)',
              type: 'number',
              span: 2,
              description: 'Saving marks this record as a manual correction.',
            },
          ]}
        />
      ) : (
        <ReadOnlyRecord record={record} />
      )}
    </div>
  )
}

function ReadOnlyRecord({ record }: { record: AttendanceListItem }) {
  const rows: Array<[string, string]> = [
    ['Check in', formatTime(record.checkIn)],
    ['Check out', record.checkOut ? formatTime(record.checkOut) : '—'],
    ['Break', `${record.breakMinutes} min`],
    ['Worked hours', formatHours(record.workedHours)],
  ]

  return (
    <div className="rounded-lg border border-border">
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Your role can view attendance but not correct it.
      </p>
    </div>
  )
}
