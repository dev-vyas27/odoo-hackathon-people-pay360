'use client'

/**
 * Compute · Validate · Mark Paid · Send Payslips.
 *
 * Buttons are enabled from the SAME transition table the aggregate enforces
 * (`canTransition`), so the UI and the domain cannot disagree about what is
 * possible — and the server still refuses illegal transitions regardless of what
 * a client sends.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LuBanknote, LuCalculator, LuCircleCheck, LuLoaderCircle, LuSend } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { canTransition, type PayrunView } from '@/modules/payroll-processing'
import { Button } from '@/components/ui/button'
import { ApiError, apiPost } from '../../_lib/api'

interface ComputeResponse {
  skipped: Array<{ employeeName: string; reason: string }>
  payslips: unknown[]
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
   * Delivery is Dev A's module and its route may not exist yet. A 404 here is a
   * known integration gap, not a payroll failure, so it is reported as such
   * rather than as a generic error.
   */
  async function sendPayslips() {
    setBusy('send')
    try {
      await apiPost(`/api/payruns/${payrun.id}/send`)
      toast.success('Payslips sent')
    } catch (reason) {
      const notBuiltYet = reason instanceof ApiError && reason.status === 404
      toast.error(
        notBuiltYet
          ? 'Payslip delivery is not available yet.'
          : reason instanceof ApiError
            ? reason.message
            : 'Could not send payslips',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      <Action
        icon={LuCircleCheck}
        label="Validate"
        busy={busy === 'validate'}
        disabled={Boolean(busy) || !canTransition(payrun.status, 'validated')}
        onClick={() => run('validate', () => toast.success('Pay run validated'))}
      />

      <Action
        icon={LuBanknote}
        label="Mark paid"
        busy={busy === 'mark-paid'}
        disabled={Boolean(busy) || !canTransition(payrun.status, 'paid')}
        onClick={() => run('mark-paid', () => toast.success('Pay run marked as paid'))}
      />

      <Action
        icon={LuSend}
        label="Send payslips"
        variant="outline"
        busy={busy === 'send'}
        disabled={Boolean(busy) || !payslipCount}
        onClick={sendPayslips}
      />
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
