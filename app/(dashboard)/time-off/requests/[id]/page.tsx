'use client'



import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuArrowLeft, LuCheck, LuSend, LuTrash2, LuX } from 'react-icons/lu'
import type { LeaveRequestDetail } from '@/modules/timeoff/schemas'
import { useDeleteResource, useResourceAction, useResourceItem } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { StatusBadge } from '@/components/resource/status-badge'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateRange, formatDuration } from '../../_components/format'

const RESOURCE = 'time-off/requests'

export default function LeaveRequestPage({ params }: { params: Promise<{ id: string }> }) {
  
  const { id } = use(params)
  const router = useRouter()

  const { data: request, isLoading } = useResourceItem<LeaveRequestDetail>(RESOURCE, id)

  const submit = useResourceAction(RESOURCE, 'submit', { successMessage: 'Sent for approval' })
  const approve = useResourceAction(RESOURCE, 'approve', {
    successMessage: 'Approved — balance updated',
  })
  const refuse = useResourceAction(RESOURCE, 'refuse', { successMessage: 'Refused' })
  const remove = useDeleteResource(RESOURCE, { successMessage: 'Request withdrawn' })

  if (isLoading || !request) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const busy =
    submit.isPending || approve.isPending || refuse.isPending || remove.isPending

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${request.employeeName} — ${request.timeOffTypeName}`}
        description={formatDateRange(request.start, request.end)}
        actions={
          <Button variant="outline" asChild>
            <Link href="/time-off/requests">
              <LuArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Request</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={request.status} />
              </dd>

              <dt className="text-muted-foreground">Dates</dt>
              <dd className="tabular">{formatDateRange(request.start, request.end)}</dd>

              <dt className="text-muted-foreground">Duration</dt>
              <dd className="tabular">{formatDuration(request.duration, request.unit)}</dd>

              <dt className="text-muted-foreground">Paid</dt>
              <dd>{request.isPaid ? 'Yes' : 'Unpaid leave'}</dd>

              {request.decidedAt ? (
                <>
                  <dt className="text-muted-foreground">Decided</dt>
                  <dd className="tabular">
                    {formatDate(request.decidedAt)}
                    {request.autoApprove && request.status === 'approved' ? (
                      <span className="ml-1 text-muted-foreground">— auto-approved</span>
                    ) : null}
                  </dd>
                </>
              ) : null}

              {request.reason ? (
                <>
                  <dt className="col-span-2 text-muted-foreground">Reason</dt>
                  <dd className="col-span-2">{request.reason}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {!request.requiresAllocation ? (
              <p className="text-sm text-muted-foreground">
                {request.timeOffTypeName} needs no allocation, so approving it consumes no
                balance and can never overdraw.
              </p>
            ) : request.balance ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Allocated</dt>
                <dd className="tabular">
                  {formatDuration(request.balance.allocated, request.balance.unit)}
                </dd>

                <dt className="text-muted-foreground">Taken</dt>
                <dd className="tabular">
                  {formatDuration(request.balance.taken, request.balance.unit)}
                </dd>

                <dt className="text-muted-foreground">Pending</dt>
                <dd className="tabular">
                  {formatDuration(request.balance.pending, request.balance.unit)}
                </dd>

                <dt className="text-muted-foreground">Remaining</dt>
                <dd
                  className={
                    request.balance.remaining < 0
                      ? 'tabular text-destructive'
                      : 'tabular text-success'
                  }
                >
                  {formatDuration(request.balance.remaining, request.balance.unit)}
                </dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No allocation covers these dates yet. Approving will be refused until one is
                granted.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {
}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        {request.canSubmit ? (
          <Button onClick={() => submit.mutate({ id })} disabled={busy}>
            <LuSend aria-hidden />
            Send for approval
          </Button>
        ) : null}

        {request.canApprove ? (
          <ConfirmDialog
            title="Approve this request?"
            description={
              request.requiresAllocation
                ? `This deducts ${formatDuration(request.duration, request.unit)} from ${request.employeeName}'s allocation.`
                : 'This leave type consumes no allocation.'
            }
            confirmLabel="Approve"
            onConfirm={() => approve.mutateAsync({ id })}
            trigger={
              <Button disabled={busy}>
                <LuCheck aria-hidden />
                Approve
              </Button>
            }
          />
        ) : null}

        {request.canRefuse ? (
          <ConfirmDialog
            title="Refuse this request?"
            description={
              request.status === 'approved'
                ? `This reverses the approval and returns ${formatDuration(request.duration, request.unit)} to the allocation.`
                : 'The employee will be able to raise a new request for these dates.'
            }
            confirmLabel="Refuse"
            destructive
            onConfirm={() => refuse.mutateAsync({ id })}
            trigger={
              <Button variant="outline" disabled={busy}>
                <LuX aria-hidden />
                Refuse
              </Button>
            }
          />
        ) : null}

        {request.canEdit ? (
          <ConfirmDialog
            title="Withdraw this request?"
            description="Only drafts can be withdrawn. This cannot be undone."
            confirmLabel="Withdraw"
            destructive
            onConfirm={async () => {
              await remove.mutateAsync(id)
              router.push('/time-off/requests')
            }}
            trigger={
              <Button variant="ghost" disabled={busy} className="ml-auto">
                <LuTrash2 aria-hidden />
                Withdraw
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  )
}
