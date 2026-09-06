


import { PORT_KEYS, providePort, type LeaveStatsPort } from '@/modules/shared'
import { PostgresLeaveStatsAdapter } from './infrastructure/leave-stats.adapter'

export function registerTimeOff(): void {
  providePort<LeaveStatsPort>(PORT_KEYS.leaveStats, () => new PostgresLeaveStatsAdapter())
}
