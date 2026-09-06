

import type { Period } from '@/modules/shared'

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  overtimeHours: number
  missingCheckouts: number
  manualEdits: number
}

export interface AttendanceStatsPort {
  workedHours(employeeId: string, period: Period): Promise<number>
  
  workedDays(employeeId: string, period: Period): Promise<number>
  
  workedDaysForMany(employeeIds: string[], period: Period): Promise<Map<string, number>>
  summary(period: Period, departmentId?: string): Promise<AttendanceSummary>
}
