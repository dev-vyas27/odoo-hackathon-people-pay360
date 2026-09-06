/**
 * India Standard Time, in one place.
 *
 * The company runs on IST, so "today" and "midnight" mean IST today and IST
 * midnight — not UTC's. Everything is still STORED in UTC (`timestamptz`); this
 * module only answers the questions that need a civil calendar:
 *
 *   - which day does this instant belong to?
 *   - what does the clock on the wall say?
 *   - when does the day end, so an open shift can be closed?
 *
 * IST is UTC+05:30 and has no daylight saving, has not since 1945, and is not
 * scheduled to acquire any. That is the only reason a fixed offset is honest
 * here — do not copy this file for a zone that observes DST, where the offset
 * depends on the date and `Intl` is the only correct answer.
 *
 * The five and a half hours matter. An employee checking in at 02:00 IST is on
 * the previous UTC day, so a UTC-derived `worked_on` would file their shift
 * against yesterday and the auto-close at midnight would fire a whole afternoon
 * early.
 */

/** +05:30 in milliseconds. */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export const IST_LABEL = 'IST'

/**
 * The instant shifted so that UTC getters read as IST wall-clock values.
 *
 * Only ever used to READ parts (year/month/day/hours). The returned Date is not
 * a real instant and must never be stored — see `fromIstParts` for the inverse.
 */
function istView(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MS)
}

/** `YYYY-MM-DD` for the IST day this instant falls in. */
export function istDay(instant: Date = new Date()): string {
  return istView(instant).toISOString().slice(0, 10)
}

/** `HH:mm`, 24-hour, as the wall clock in India reads it. */
export function istTime(instant: Date = new Date()): string {
  return istView(instant).toISOString().slice(11, 16)
}

/** Turn IST wall-clock parts back into a real UTC instant. */
function fromIstParts(day: string, hours: number, minutes: number, seconds = 0): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, hours, minutes, seconds) - IST_OFFSET_MS)
}

/** 00:00:00 IST on the given IST day, as a UTC instant. */
export function istStartOfDay(day: string): Date {
  return fromIstParts(day, 0, 0)
}

/**
 * The last representable second of an IST day, as a UTC instant.
 *
 * 23:59:59 rather than the next day's 00:00:00 on purpose: the value is written
 * to `checked_out_at` when a shift is auto-closed, and midnight would land the
 * check-out on the FOLLOWING day — where it would both read as an overnight
 * shift and collide with that day's own record.
 */
export function istEndOfDay(day: string): Date {
  return fromIstParts(day, 23, 59, 59)
}

/** Midnight IST that begins the day AFTER this instant — the auto-close boundary. */
export function istNextMidnight(instant: Date = new Date()): Date {
  return new Date(istStartOfDay(istDay(instant)).getTime() + 24 * 60 * 60 * 1000)
}

/** Whole minutes between two instants, never negative. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))
}

/** `7h 20m` — a duration a person reads, not a decimal they have to convert. */
export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}
