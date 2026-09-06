'use client'



import { useCallback, useState, useSyncExternalStore } from 'react'
import { LuLoaderCircle, LuLogIn, LuLogOut } from 'react-icons/lu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  WORK_MODES,
  WORK_MODE_LABELS,
  type TodayAttendanceView,
  type WorkMode,
} from '@/modules/attendance/schemas'
import { ApiError, apiFetch } from '@/lib/api-client'
import { formatDuration, istTime, IST_LABEL } from '@/modules/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'



const tickers = new Set<() => void>()
let ticking: ReturnType<typeof setInterval> | null = null
let tick = 0

function subscribeToTick(listener: () => void): () => void {
  tickers.add(listener)
  if (!ticking) {
    ticking = setInterval(() => {
      tick = Date.now()
      for (const fn of tickers) fn()
    }, 1000)
  }
  tick = Date.now()
  return () => {
    tickers.delete(listener)
    if (tickers.size === 0 && ticking) {
      clearInterval(ticking)
      ticking = null
    }
  }
}

const getTick = () => tick
const getServerTick = () => 0

export function ClockWidget({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient()
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [workMode, setWorkMode] = useState<WorkMode>('office')

  const { data, isLoading, dataUpdatedAt } = useQuery<TodayAttendanceView>({
    queryKey: ['attendance', 'today'],
    queryFn: () => apiFetch<TodayAttendanceView>('/api/attendance/today'),
    


    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const tick = useSyncExternalStore(subscribeToTick, getTick, getServerTick)

  


  const now =
    data && dataUpdatedAt
      ? new Date(Math.max(tick, dataUpdatedAt) + (new Date(data.now).getTime() - dataUpdatedAt))
      : null

  
  const settle = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] }),
      queryClient.invalidateQueries({ queryKey: ['resource', 'attendance'] }),
    ])
  }, [queryClient])

  const fail = (reason: unknown, fallback: string) =>
    toast.error(reason instanceof ApiError ? reason.message : fallback)

  const checkIn = useMutation({
    mutationFn: (mode: WorkMode) =>
      apiFetch('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ employeeId, workMode: mode }),
      }),
    onSuccess: async () => {
      setCheckingIn(false)
      await settle()
      toast.success('Checked in')
    },
    onError: (reason) => fail(reason, 'Could not check you in.'),
  })

  const checkOut = useMutation({
    mutationFn: (attendanceId: string) =>
      apiFetch(`/api/attendance/${attendanceId}/check-out`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      setCheckingOut(false)
      await settle()
      toast.success('Checked out')
    },
    onError: (reason) => fail(reason, 'Could not check you out.'),
  })

  if (isLoading || !data || !now) {
    return <Skeleton className="h-14 w-56" />
  }

  const isIn = data.state === 'checked_in'

  


  const workedMinutes =
    isIn && data.checkedInAt
      ? Math.max(
          0,
          Math.round((now.getTime() - new Date(data.checkedInAt).getTime()) / 60_000) -
            data.breakMinutes,
        )
      : data.workedMinutes

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="tabular text-xl font-medium leading-none text-foreground">
            {istTime(now)}
            <span className="ml-1.5 align-middle text-xs font-normal text-muted-foreground">
              {IST_LABEL}
            </span>
          </p>
          {}
          {data.checkedInAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isIn ? 'Checked in at' : 'Checked out at'}{' '}
              <span className="tabular">
                {istTime(new Date((isIn ? data.checkedInAt : data.checkedOutAt) ?? data.checkedInAt))}
              </span>
              {data.breakMinutes > 0 ? ` · ${formatDuration(data.breakMinutes)} break` : null}
            </p>
          ) : null}
        </div>

        <Button
          onClick={() => (isIn ? setCheckingOut(true) : setCheckingIn(true))}
          variant={isIn ? 'outline' : 'default'}
        >
          {isIn ? <LuLogOut aria-hidden /> : <LuLogIn aria-hidden />}
          {isIn ? 'Check Out' : 'Check In'}
        </Button>
      </div>

      {}
      <Dialog open={checkingIn} onOpenChange={setCheckingIn}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Working from?</DialogTitle>
            <DialogDescription>
              {data.state === 'checked_out'
                ? `Picking up where you left off. Time away counts as a break.`
                : `Your shift starts when you confirm, at ${istTime(now)} ${IST_LABEL}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="work-mode">Location</Label>
            <Select value={workMode} onValueChange={(value) => setWorkMode(value as WorkMode)}>
              <SelectTrigger id="work-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {WORK_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckingIn(false)}>
              Cancel
            </Button>
            <Button onClick={() => checkIn.mutate(workMode)} disabled={checkIn.isPending}>
              {checkIn.isPending ? (
                <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <LuLogIn aria-hidden />
              )}
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={checkingOut} onOpenChange={setCheckingOut}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check out?</DialogTitle>
            <DialogDescription>
              Your shift will be closed at {istTime(now)} {IST_LABEL}.
            </DialogDescription>
          </DialogHeader>

          {}
          <div className="rounded-md border border-border bg-sunken px-4 py-3">
            <p className="eyebrow">Time worked today</p>
            <p className="tabular mt-1 text-xl font-medium text-foreground">
              {formatDuration(workedMinutes)}
            </p>
            {data.checkedInAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Since <span className="tabular">{istTime(new Date(data.checkedInAt))}</span>
                {data.breakMinutes > 0
                  ? `, less ${formatDuration(data.breakMinutes)} of break`
                  : null}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckingOut(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => data.attendanceId && checkOut.mutate(data.attendanceId)}
              disabled={checkOut.isPending || !data.attendanceId}
            >
              {checkOut.isPending ? (
                <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <LuLogOut aria-hidden />
              )}
              Confirm check-out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
