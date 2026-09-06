

import type { DailySchedule } from '../../domain/exception'

export interface ScheduleLookupPort {
  
  scheduleForDay(employeeId: string, date: Date): Promise<DailySchedule | null>
}
