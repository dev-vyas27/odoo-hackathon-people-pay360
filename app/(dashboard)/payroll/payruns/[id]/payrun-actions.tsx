'use client'

/**
 * Compute · Validate · Mark Paid · Send Payslips.
 *
 * Each button answers TWO questions, and both have to be yes:
 *
 *   1. May this pay run move there? — `canTransition`, the same table the
 *      aggregate enforces, so the UI and the domain agree about what is
 *      possible.
 *   2. May THIS ROLE do it? — `can()`, the same table the use case authorises
 *      with.
 *
 * The second was missing, and the gap was not theoretical: `hr_payroll_user`
 * holds payrun create/read/update but NOT `payrun:approve`, so Validate and
 * Mark paid were offered to exactly the role that cannot use them and answered
 * with a 403. The server refuses regardless of what a client sends; this is
 * about not offering an action that will fail.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LuBanknote, LuCalculator, LuCircleCheck, LuLoaderCircle, LuSend } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { canTransition, type PayrunView } from '@/modules/payroll-processing'
import { useCan } from '@/components/auth/current-user'
import { Button } from '@/components/ui/button'
import { ApiError, apiPost } from '../../_lib/api'

interface ComputeResponse {
  skipped: Array<{ employeeName: string; reason: string }>
  payslips: unknown[]
}

interface SendResponse {
  sent: number
  failed: number
  deliveries: Array<{
    employeeName: string
    sent: boolean
    archived: boolean
    reason?: string
  }>
}

export function PayrunActions({
  payrun,
  payslipCount,
}: {
  payrun: PayrunView
  payslipCount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Computing edits the run; validating and paying it are approvals.
  const canCompute = useCan('payrun', 'update')
  const canApprove = useCan('payrun', 'approve')
  // Sending mails every employee in the run — the same grant the use case wants.
  const canSend = useCan('payslip', 'update')

  async function run(action: string, onDone: (result: unknown) => void) {
    setBusy(action)
    try {
      const result = await apiPost(`/api/payruns/${payrun.id}/${action}`)
      onDone(result)
      router.refresh()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : `Could not ${action} this pay run`)
    } finally {
      setBusy(null)
    }
  }

  /**
   * Bulk delivery reports PER EMPLOYEE, so the toast does too.
   *
   * "Payslips sent" over a run where two people have no email address is a lie
   * of omission — those two are the only ones anybody needed to hear about. The
   * server returns a delivery per payslip; this surfaces the failures by name
   * and keeps the message on screen long enough to read them.
   */
  async function sendPayslips() {
    setBusy('send')
    try {
      const result = (await apiPost(`/api/payruns/${payrun.id}/send`)) as SendResponse

      if (result.failed === 0) {
        toast.success(
          `Sent ${result.sent} payslip${result.sent === 1 ? '' : 's'}${
            result.deliveries.every((d) => d.archived) ? ' and archived them' : ''
          }`,
        )
        return
      }

      const unsent = result.deliveries.filter((d) => !d.sent)
      toast(
        [
          `Sent ${result.sent} of ${result.sent + result.failed}.`,
          ...unsent.slice(0, 4).map((d) => `• ${d.employeeName}: ${d.reason ?? 'failed'}`),
          unsent.length > 4 ? `…and ${unsent.length - 4} more` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        { duration: 10_000, icon: '⚠️' },
      )
    } catch (reason) {
      toast.error(
        reason instanceof ApiError ? reason.message : 'Could not send payslips',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCompute ? (
      <Action
        icon={LuCalculator}
        label={payslipCount ? 'Recompute' : 'Compute'}
        busy={busy === 'compute'}
        disabled={Boolean(busy) || !canTransition(payrun.status, 'computed')}
        onClick={() =>
          run('compute', (result) => {
            const { skipped } = result as ComputeResponse
            if (skipped?.length) {
              toast(
                `Computed with ${skipped.length} employee${skipped.length === 1 ? '' : 's'} skipped: ${skipped
                  .map((s) => s.employeeName)
                  .join(', ')}`,
              )
            } else {
              toast.success('Payslips computed')
            }
          })
        }
      />
      ) : null}

      {canApprove ? (
        <Action
          icon={LuCircleCheck}
          label="Validate"
          busy={busy === 'validate'}
          disabled={Boolean(busy) || !canTransition(payrun.status, 'validated')}
          onClick={() => run('validate', () => toast.success('Pay run validated'))}
        />
      ) : null}

      {canApprove ? (
        <Action
          icon={LuBanknote}
          label="Mark paid"
          busy={busy === 'mark-paid'}
          disabled={Boolean(busy) || !canTransition(payrun.status, 'paid')}
          onClick={() => run('mark-paid', () => toast.success('Pay run marked as paid'))}
        />
      ) : null}

      {canSend ? (
        <Action
          icon={LuSend}
          label="Send payslips"
          variant="outline"
          busy={busy === 'send'}
          disabled={Boolean(busy) || !payslipCount}
          onClick={sendPayslips}
        />
      ) : null}
    </div>
  )
}

function Action({
  icon: Icon,
  label,
  busy,
  disabled,
  onClick,
  variant = 'default',
}: {
  icon: IconType
  label: string
  busy: boolean
  disabled: boolean
  onClick: () => void
  variant?: 'default' | 'outline'
}) {
  return (
    <Button type="button" variant={variant} onClick={onClick} disabled={disabled || busy}>
      {busy ? (
        <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  )
}
