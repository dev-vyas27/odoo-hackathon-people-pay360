

import { DomainError, Err, Ok, type Result } from '@/modules/shared'

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

export function computeWorkedHours(
  checkIn: Date,
  checkOut: Date | null,
  breakMinutes: number,
): Result<number> {
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return Err(
      DomainError.validation('INVALID_BREAK_MINUTES', 'Break minutes must be a non-negative number'),
    )
  }

  if (!checkOut) {
    return Err(
      DomainError.rule(
        'MISSING_CHECKOUT',
        'Worked hours cannot be computed until the employee checks out',
      ),
    )
  }

  let durationMs = checkOut.getTime() - checkIn.getTime()

  
  
  if (durationMs < 0) {
    durationMs += MS_PER_DAY
  }

  if (durationMs <= 0) {
    return Err(
      DomainError.validation(
        'ZERO_DURATION_SHIFT',
        'Check-out must be after check-in',
      ),
    )
  }

  const breakMs = breakMinutes * 60_000
  if (breakMs > durationMs) {
    return Err(
      DomainError.validation(
        'BREAK_EXCEEDS_SHIFT',
        'The break duration exceeds the length of the shift',
      ),
    )
  }

  const workedMs = durationMs - breakMs
  return Ok(workedMs / MS_PER_HOUR)
}
