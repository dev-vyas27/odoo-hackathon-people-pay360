/**
 * Display helpers shared by the three Time Off screens.
 *
 * Dates arrive as ISO strings at UTC midnight (see `toUtcDate` in the
 * infrastructure layer). Formatting them with a local-timezone formatter would
 * show the previous day for anyone west of UTC — which, for a leave request,
 * is not a cosmetic bug. So every formatter here is pinned to UTC.
 */

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const DAY_SHORT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
})

export function formatDate(iso: string): string {
  return DAY.format(new Date(iso))
}

/**
 * "02–06 Mar 2026" for a range inside one month, "28 Feb – 03 Mar 2026" across
 * months, and a single date when both ends are the same day.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (start.getTime() === end.getTime()) return DAY.format(start)

  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()

  return sameMonth
    ? `${String(start.getUTCDate()).padStart(2, '0')}–${DAY.format(end)}`
    : `${DAY_SHORT.format(start)} – ${DAY.format(end)}`
}

/** "5 days", "1 day", "7.5 hours" — the unit comes from the leave type. */
export function formatDuration(duration: number, unit: 'day' | 'hour'): string {
  const amount = Number.isInteger(duration) ? String(duration) : duration.toFixed(1)
  const plural = duration === 1 ? unit : `${unit}s`
  return `${amount} ${plural}`
}

/** The value a <input type="date"> expects. */
export function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}
