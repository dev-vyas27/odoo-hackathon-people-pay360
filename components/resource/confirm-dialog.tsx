'use client'



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
  
  destructive?: boolean
  


  onConfirm: () => unknown | Promise<unknown>
  trigger?: React.ReactNode
  
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
