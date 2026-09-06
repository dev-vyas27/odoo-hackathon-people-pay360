'use client'

/**
 * Self-service check-in / check-out, for the employee's own shift.
 *
 * Sits where "Record attendance" sits for HR — the same corner of the same
 * page — because it is the same job seen from the other side: HR files a record
 * about somebody, an employee files one about themselves.
 *
 * ── The clock is the server's ──────────────────────────────────────────────
 *
 * The displayed time ticks locally, but it is anchored to the `now` the API
 * returned and only advances from there. A laptop with a wrong clock therefore
 * shows the time the record will actually be stamped with, instead of a time
 * that disagrees with it — a disagreement nobody notices until it becomes an
 * argument about hours worked.
 *
 * ── Two steps, never one ───────────────────────────────────────────────────
 *
 * Check-in asks where you are working before it opens the shift; check-out
 * states the total before it closes one. Both are single, irreversible-feeling
 * acts against a real timesheet, and neither should happen on a stray tap.
 */
import { useCallback, useState, useSyncExternalStore } from 'react'
import { LuLoaderCircle, LuLogIn, LuLogOut } from 'react-icons/lu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
// NOT '@/modules/attendance' — that barrel reaches the Postgres repository,
// and pulling the pg driver into a client bundle breaks at module evaluation.
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

/**
 * One second, shared by every subscriber.
 *
 * The passage of time is an external source, so it is subscribed to rather than
 * copied into state by an effect — the same reason the theme store is built
 * this way. One interval serves every mounted clock and stops itself when the
 * last one unmounts.
 *
 * The snapshot is a NUMBER. Returning a fresh `Date` would be a new reference
 * on every read, and React would re-render forever.
 */
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
    /**
     * The shift's own clock is local, but break minutes and the auto-close
     * sweep are server-side. A slow refetch keeps a tab left open all day
     * honest without polling every second for something that changes twice.
     */
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const tick = useSyncExternalStore(subscribeToTick, getTick, getServerTick)

  /**
   * The gap between this browser's clock and the server's.
   *
   * `dataUpdatedAt` is when React Query received the response, on the LOCAL
   * clock; `data.now` is what the server said at that moment. The difference is
   * the skew, and adding it to local time gives the time the record will
   * actually be stamped with — which is the only time worth showing somebody
   * about to commit to a timesheet. Re-derived on every refetch, so a tab left
   * open all day cannot drift, and no effect is needed to re-anchor it.
   */
  const now =
    data && dataUpdatedAt
      ? new Date(Math.max(tick, dataUpdatedAt) + (new Date(data.now).getTime() - dataUpdatedAt))
      : null

  /** Both mutations refresh the same two things: the clock and the list. */
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

  /**
   * Live for an open shift.
   *
   * `workedMinutes` from the server is a snapshot; recomputing against the
   * ticking clock is what makes the check-out dialog show a total that matches
   * what the person is looking at rather than what it was a minute ago.
   */
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
          {/* What the record currently says, under the clock that is making it. */}
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

      {/* ── Check in ─────────────────────────────────────────────────────── */}
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

      {/* ── Check out ────────────────────────────────────────────────────── */}
      <Dialog open={checkingOut} onOpenChange={setCheckingOut}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check out?</DialogTitle>
            <DialogDescription>
              Your shift will be closed at {istTime(now)} {IST_LABEL}.
            </DialogDescription>
          </DialogHeader>

          {/* The total, stated before it is committed. */}
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
