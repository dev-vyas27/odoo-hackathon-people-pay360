/**
 * The states every payroll screen needs besides "it worked".
 *
 * Kept together so an error looks the same on the payslip screen as on the rule
 * list, and so no screen is tempted to render `null` when something fails.
 */
import { LuCircleAlert, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import { cn } from '@/lib/utils'

export function ErrorState({ title = 'Could not load this page', message }: { title?: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <LuCircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}

export function InfoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/8 px-4 py-3 text-sm text-foreground',
        className,
      )}
    >
      <LuInfo className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function WarningNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground',
        className,
      )}
    >
      <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
      <div className="space-y-1">{children}</div>
    </div>
  )
}

/** A labelled read-only value, used across the payrun and payslip headers. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}
