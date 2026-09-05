/**
 * Attendance — AGGREGATE ROOT.
 *
 * One check-in/check-out cycle for one employee. Worked hours are never
 * stored redundantly — they are always derived from checkIn/checkOut/break
 * through worked-hours.service, so the two can never drift apart.
 */
import { DomainError, Err, Ok, type Result } from '@/modules/shared'
import { computeWorkedHours } from './worked-hours.service'
import { deriveStatus, type AttendanceStatus, type DailySchedule } from './exception'

export interface AttendanceProps {
  id: string
  employeeId: string
  checkIn: Date
  checkOut: Date | null
  breakMinutes: number
  /** True once the record has been hand-corrected by an authorized user. */
  manual: boolean
  createdAt: Date
  updatedAt: Date
}

export interface NewAttendanceInput {
  employeeId: string
  checkIn: Date
  breakMinutes?: number
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
        manual: false,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }

  /** Rebuild from persisted data. Trusted — validation already happened once. */
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

  /** Worked hours, or an Err (e.g. MISSING_CHECKOUT) when they cannot be computed yet. */
  workedHours(): Result<number> {
    return computeWorkedHours(this.props.checkIn, this.props.checkOut, this.props.breakMinutes)
  }

  /** Worked hours if computable, otherwise null — convenient for status derivation and stats. */
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
    const validated = computeWorkedHours(this.props.checkIn, checkOut, nextBreak)
    if (!validated.ok) return Err(validated.error)

    return Ok(
      new Attendance({
        ...this.props,
        checkOut,
        breakMinutes: nextBreak,
        updatedAt: new Date(),
      }),
    )
  }

  /** Authorized correction. Always flips `manual` on, whatever else changes. */
  correct(patch: { checkIn?: Date; checkOut?: Date | null; breakMinutes?: number }): Result<Attendance> {
    const nextCheckIn = patch.checkIn ?? this.props.checkIn
    const nextCheckOut = patch.checkOut === undefined ? this.props.checkOut : patch.checkOut
    const nextBreak = patch.breakMinutes ?? this.props.breakMinutes

    if (!Number.isFinite(nextBreak) || nextBreak < 0) {
      return Err(DomainError.validation('INVALID_BREAK_MINUTES', 'Break minutes must be a non-negative number'))
    }

    // Only validate worked-hours maths when the record is (or becomes) complete —
    // a correction is allowed to leave a check-out blank.
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
