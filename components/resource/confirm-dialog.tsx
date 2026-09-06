'use client'

/**
 * ConfirmDialog — one place that asks "are you sure".
 *
 * Destructive and irreversible actions (delete an employee, validate a payrun,
 * mark a run paid) all need the same pause. Standardising it means the wording
 * and the danger styling cannot drift between modules, and it means the busy
 * state during the action is handled once rather than per screen.
 *
 * Two ways to use it:
 *   <ConfirmDialog trigger={<Button>Delete</Button>} onConfirm={...} />
 *   const confirm = useConfirm()   // imperative, for row menus
 */
import { useCallback, useState } from 'react'
import { LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `true` paints the confirm button destructive and adds a warning glyph. */
  destructive?: boolean
  /**
   * Awaited before the dialog closes. Typed loosely on purpose: callers hand it
   * a TanStack `mutateAsync`, which resolves with the mutation's result rather
   * than void, and forcing every call site to wrap that in `() => { ...; }` to
   * discard the value would be noise.
   */
  onConfirm: () => unknown | Promise<unknown>
  trigger?: React.ReactNode
  /** Controlled mode — omit `trigger` and drive it yourself. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isOpen = open ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      // Always clear busy: if the action failed the user must be able to retry
      // or cancel, and a permanently spinning button is a dead end.
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={busy ? undefined : setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive ? (
              <LuTriangleAlert className="size-4 text-destructive" aria-hidden />
            ) : null}
            {title}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? <LuLoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ConfirmRequest = Omit<ConfirmDialogProps, 'trigger' | 'open' | 'onOpenChange'>

/**
 * Imperative variant. Render `dialog` once in the screen and call `confirm({...})`
 * from a row action, where wrapping each row in a `<ConfirmDialog>` would mean
 * one mounted dialog per row.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), [])

  const dialog = request ? (
    <ConfirmDialog
      {...request}
      open
      onOpenChange={(next) => {
        if (!next) setRequest(null)
      }}
    />
  ) : null

  return { confirm, dialog }
}
