

import { PORT_KEYS, portOr, type ScheduleQueryPort } from '@/modules/shared'

export type { ScheduleQueryPort }

export const UNRESOLVED_SCHEDULE_QUERY: ScheduleQueryPort = {
  async findById() {
    return null
  },
  async expectedHours() {
    return 0
  },
  async expectedDays() {
    return 0
  },
}

export function scheduleLookup(): ScheduleQueryPort {
  return portOr(PORT_KEYS.scheduleQuery, UNRESOLVED_SCHEDULE_QUERY)
}
