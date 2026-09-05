/**
 * Display formatting for payroll screens.
 *
 * Amounts arrive from the API as plain rupee numbers (Money has already done
 * the rounding), so these only decide how they LOOK. Never do arithmetic here.
 */
export function formatMoney(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatPeriod(start: string | Date, end: string | Date): string {
  return `${formatDay(start)} – ${formatDay(end)}`
}

/** "2026-01-31", the value an <input type="date"> expects. */
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** First and last day of the month containing `date`, as date-input strings. */
export function monthBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start: toDateInput(start), end: toDateInput(end) }
}
