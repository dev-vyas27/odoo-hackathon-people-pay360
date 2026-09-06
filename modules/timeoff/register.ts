/**
 * What `timeoff` publishes to the rest of the app.
 *
 * Called once per process by `lib/bootstrap.ts`. Registering a port is lazy —
 * `providePort` stores the factory, not the instance — so this does not open a
 * database connection at import time.
 */
import { PORT_KEYS, providePort, type LeaveStatsPort } from '@/modules/shared'
import { PostgresLeaveStatsAdapter } from './infrastructure/leave-stats.adapter'

export function registerTimeOff(): void {
  providePort<LeaveStatsPort>(PORT_KEYS.leaveStats, () => new PostgresLeaveStatsAdapter())
}
