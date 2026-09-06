


import {
  authorizeOwned,
  istDay,
  minutesBetween,
  Ok,
  type Actor,
  type Result,
} from '@/modules/shared'
import type { AttendanceRepositoryPort } from './ports/attendance-repository.port'
import type { WorkMode } from '../domain/work-mode'

export interface GetTodayAttendanceInput {
  actor: Actor
  employeeId: string
}

export interface TodayAttendance {
  
  day: string
  
  now: string
  state: 'not_started' | 'checked_in' | 'checked_out'
  attendanceId: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  workMode: WorkMode | null
  breakMinutes: number
  


  workedMinutes: number
}

export class GetTodayAttendanceUseCase {
  constructor(private readonly repo: AttendanceRepositoryPort) {}

  async execute(input: GetTodayAttendanceInput): Promise<Result<TodayAttendance>> {
    const authz = authorizeOwned(input.actor, 'attendance', 'read', input.employeeId)
    if (!authz.ok) return authz

    const now = new Date()
    const today = new Date(`${istDay(now)}T00:00:00.000Z`)

    


    await this.repo.closeStaleOpenShifts(today)

    const record = await this.repo.findForEmployeeOnDay(input.employeeId, today)

    if (!record) {
      return Ok({
        day: istDay(now),
        now: now.toISOString(),
        state: 'not_started',
        attendanceId: null,
        checkedInAt: null,
        checkedOutAt: null,
        workMode: null,
        breakMinutes: 0,
        workedMinutes: 0,
      })
    }

    const { attendance } = record
    const open = attendance.isOpen
    const until = attendance.checkOut ?? now

    return Ok({
      day: istDay(now),
      now: now.toISOString(),
      state: open ? 'checked_in' : 'checked_out',
      attendanceId: attendance.id,
      checkedInAt: attendance.checkIn.toISOString(),
      checkedOutAt: attendance.checkOut ? attendance.checkOut.toISOString() : null,
      workMode: attendance.workMode,
      breakMinutes: attendance.breakMinutes,
      workedMinutes: Math.max(
        0,
        minutesBetween(attendance.checkIn, until) - attendance.breakMinutes,
      ),
    })
  }
}
