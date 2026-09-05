/**
 * worked-hours.service — PURE.
 *
 * Given a check-in, an optional check-out and a break, compute the hours
 * actually worked. No I/O, no dates outside the arguments, no framework.
 *
 * Tricky cases handled explicitly (see worked-hours.service.test.ts):
 *  - Missing check-out: worked hours CANNOT be computed. We do not silently
 *    return 0 (that would look like an absence) — callers get an explicit
 *    Err so the record can be surfaced as "missing_checkout".
 *  - A shift crossing midnight: if the check-out timestamp is numerically
 *    before the check-in timestamp we treat it as having rolled into the
 *    next calendar day (23:00 -> 06:00) rather than producing a negative
 *    duration.
 *  - A break that is longer than the shift itself is a data-entry error and
 *    is rejected rather than silently clamped or turned into negative hours.
 */
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

  // Shift crosses midnight: the recorded check-out is numerically earlier in
  // the day than check-in, so it must belong to the following calendar day.
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
