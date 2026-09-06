'use client'



import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LuArchive } from 'react-icons/lu'
import { Button } from '@/components/ui/button'
import { ApiError, apiDelete } from '../../_lib/api'

export function ArchiveRuleButton({
  id,
  name,
  active,
}: {
  id: string
  name: string
  active: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!active) {
    return <span className="text-sm text-muted-foreground">Archived</span>
  }

  async function archive() {
    setBusy(true)
    try {
      await apiDelete(`/api/payroll/rules/${id}`)
      toast.success(`Archived "${name}"`)
      router.refresh()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Could not archive this rule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={archive} disabled={busy}>
      <LuArchive className="size-4" aria-hidden />
      {busy ? 'Archiving...' : 'Archive'}
    </Button>
  )
}
