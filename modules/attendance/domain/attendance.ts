


import { DomainError, Err, Ok, type Result } from '@/modules/shared'
import { computeWorkedHours } from './worked-hours.service'
import { deriveStatus, type AttendanceStatus, type DailySchedule } from './exception'
import type { WorkMode } from './work-mode'

export interface AttendanceProps {
  id: string
  employeeId: string
  checkIn: Date
  checkOut: Date | null
  breakMinutes: number
  
  workMode: WorkMode | null
  
  manual: boolean
  createdAt: Date
  updatedAt: Date
}

export interface NewAttendanceInput {
  employeeId: string
  checkIn: Date
  breakMinutes?: number
  workMode?: WorkMode | null
}

const MS_PER_DAY = 86_400_000



function resolveCheckOut(checkIn: Date, checkOut: Date): Date {
  if (checkOut.getTime() >= checkIn.getTime()) return checkOut
  return new Date(checkOut.getTime() + MS_PER_DAY)
}

export class Attendance {
  private constructor(private readonly props: AttendanceProps) {}

  static checkIn(input: NewAttendanceInput): Result<Attendance> {
    const breakMinutes = input.breakMinutes ?? 0
    if (!input.employeeId) {
      return Err(DomainError.validation('EMPLOYEE_REQUIRED', 'employeeId is required'))
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
      return Err(DomainError.validation('INVALID_BREAK_MINUTES', 'Break minutes must be a non-negative number'))
    }
    const now = new Date()
    return Ok(
      new Attendance({
        id: '',
        employeeId: input.employeeId,
        checkIn: input.checkIn,
        checkOut: null,
        breakMinutes,
        workMode: input.workMode ?? null,
        manual: false,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  
  static reconstitute(props: AttendanceProps): Attendance {
    return new Attendance(props)
  }

  get id(): string {
    return this.props.id
  }
  get employeeId(): string {
    return this.props.employeeId
  }
  get checkIn(): Date {
    return this.props.checkIn
  }
  get checkOut(): Date | null {
    return this.props.checkOut
  }
  get breakMinutes(): number {
    return this.props.breakMinutes
  }
  get workMode(): WorkMode | null {
    return this.props.workMode
  }
  
  get isOpen(): boolean {
    return this.props.checkOut === null
  }
  get manual(): boolean {
    return this.props.manual
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  toProps(): AttendanceProps {
    return { ...this.props }
  }

  


  toJSON(): AttendanceProps {
    return this.toProps()
  }

  
  workedHours(): Result<number> {
    return computeWorkedHours(this.props.checkIn, this.props.checkOut, this.props.breakMinutes)
  }

  
  workedHoursOrNull(): number | null {
    const result = this.workedHours()
    return result.ok ? result.value : null
  }

  status(schedule: DailySchedule | null): AttendanceStatus {
    return deriveStatus(
      {
        checkIn: this.props.checkIn,
        checkOut: this.props.checkOut,
        workedHours: this.workedHoursOrNull(),
        manual: this.props.manual,
      },
      schedule,
    )
  }

  recordCheckOut(checkOut: Date, breakMinutes?: number): Result<Attendance> {
    if (this.props.checkOut) {
      return Err(DomainError.conflict('ALREADY_CHECKED_OUT', 'This attendance record already has a check-out'))
    }
    const nextBreak = breakMinutes ?? this.props.breakMinutes
    const resolved = resolveCheckOut(this.props.checkIn, checkOut)
    const validated = computeWorkedHours(this.props.checkIn, resolved, nextBreak)
    if (!validated.ok) return Err(validated.error)

    return Ok(
      new Attendance({
        ...this.props,
        checkOut: resolved,
        breakMinutes: nextBreak,
        updatedAt: new Date(),
      }),
    )
  }

  


  resume(at: Date, workMode?: WorkMode | null): Result<Attendance> {
    const closedAt = this.props.checkOut
    if (!closedAt) {
      return Err(
        DomainError.conflict('ALREADY_CHECKED_IN', 'This shift is already open — check out first'),
      )
    }
    if (at.getTime() < closedAt.getTime()) {
      return Err(
        DomainError.validation(
          'RESUME_BEFORE_CHECKOUT',
          'Cannot resume a shift before it was checked out',
        ),
      )
    }

    const away = Math.round((at.getTime() - closedAt.getTime()) / 60_000)

    return Ok(
      new Attendance({
        ...this.props,
        checkOut: null,
        breakMinutes: this.props.breakMinutes + away,
        workMode: workMode === undefined ? this.props.workMode : workMode,
        updatedAt: new Date(),
      }),
    )
  }

  
  correct(patch: { checkIn?: Date; checkOut?: Date | null; breakMinutes?: number }): Result<Attendance> {
    const nextCheckIn = patch.checkIn ?? this.props.checkIn
    const patched = patch.checkOut === undefined ? this.props.checkOut : patch.checkOut
    const nextCheckOut = patched ? resolveCheckOut(nextCheckIn, patched) : patched
    const nextBreak = patch.breakMinutes ?? this.props.breakMinutes

    if (!Number.isFinite(nextBreak) || nextBreak < 0) {
      return Err(DomainError.validation('INVALID_BREAK_MINUTES', 'Break minutes must be a non-negative number'))
    }

    
    
    if (nextCheckOut) {
      const validated = computeWorkedHours(nextCheckIn, nextCheckOut, nextBreak)
      if (!validated.ok) return Err(validated.error)
    }

    return Ok(
      new Attendance({
        ...this.props,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        breakMinutes: nextBreak,
        manual: true,
        updatedAt: new Date(),
      }),
    )
  }
}
