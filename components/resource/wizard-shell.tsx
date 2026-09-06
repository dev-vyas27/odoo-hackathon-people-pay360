'use client'



import { useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuCheck, LuLoaderCircle } from 'react-icons/lu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WizardStep {
  id: string
  title: string
  description?: string
  content: React.ReactNode
  
  canContinue?: boolean
}

export interface WizardShellProps {
  steps: WizardStep[]
  
  onFinish: () => Promise<void> | void
  finishLabel?: string
  onCancel?: () => void
  className?: string
}

export function WizardShell({
  steps,
  onFinish,
  finishLabel = 'Finish',
  onCancel,
  className,
}: WizardShellProps) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  const step = steps[index]
  const isLast = index === steps.length - 1
  const canContinue = step?.canContinue ?? true

  const finish = async () => {
    setBusy(true)
    try {
      await onFinish()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-8', className)}>
      {

}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {steps.map((s, i) => {
          const done = i < index
          const current = i === index
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={done ? () => setIndex(i) : undefined}
                disabled={!done || busy}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
                  done && 'cursor-pointer text-foreground hover:bg-accent',
                  current && 'text-foreground',
                  !done && !current && 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'tabular flex size-6 items-center justify-center rounded-full border text-xs',
                    done && 'border-success bg-success/12 text-success',
                    current && 'border-primary bg-primary text-primary-foreground',
                    !done && !current && 'border-border text-muted-foreground',
                  )}
                >
                  {done ? <LuCheck className="size-3" aria-hidden /> : i + 1}
                </span>
                {s.title}
              </button>
              {i < steps.length - 1 ? (
                <span className="h-px w-6 bg-border sm:w-10" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>

      {step ? (
        <div className="space-y-1">
          {step.description ? (
            <p className="text-sm text-muted-foreground">{step.description}</p>
          ) : null}
          <div className="pt-4">{step.content}</div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0 || busy}
        >
          <LuArrowLeft aria-hidden />
          Back
        </Button>

        {isLast ? (
          <Button onClick={finish} disabled={!canContinue || busy}>
            {busy ? <LuLoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {finishLabel}
          </Button>
        ) : (
          <Button
            onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={!canContinue || busy}
          >
            Continue
            <LuArrowRight aria-hidden />
          </Button>
        )}

        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="ml-auto">
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}
