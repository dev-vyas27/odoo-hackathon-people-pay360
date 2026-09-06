

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'overtime' | 'missing_checkout' | 'manual'

export interface DailySchedule {
  
  expectedStart: string
  
  expectedHours: number
  
  lateGraceMinutes?: number
  
  overtimeThresholdHours?: number
}

export interface ExceptionInput {
  checkIn: Date | null
  checkOut: Date | null
  
  workedHours: number | null
  manual: boolean
}

function toMinutesSinceMidnightUtc(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function deriveStatus(input: ExceptionInput, schedule: DailySchedule | null): AttendanceStatus {
  if (input.manual) return 'manual'
  if (!input.checkIn) return 'absent'
  if (!input.checkOut) return 'missing_checkout'

  const worked = input.workedHours ?? 0

  if (schedule) {
    const overtimeThreshold = schedule.overtimeThresholdHours ?? schedule.expectedHours
    if (worked > overtimeThreshold) return 'overtime'

    const grace = schedule.lateGraceMinutes ?? 0
    const expectedStartMinutes = parseHHmm(schedule.expectedStart)
    const checkInMinutes = toMinutesSinceMidnightUtc(input.checkIn)
    if (checkInMinutes > expectedStartMinutes + grace) return 'late'
  }

  return 'present'
}
