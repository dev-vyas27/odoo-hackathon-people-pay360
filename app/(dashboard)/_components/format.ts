/**
 * Formatting shared by the HR sections.
 *
 * Deliberately mirrors app/(dashboard)/time-off/_components/format.ts rather
 * than importing across section folders: those helpers are Dev A's and scoped
 * to Time Off. Same locale, same conventions, so the screens read as one app.
 */

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const TIME = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATE.format(new Date(iso))
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return TIME.format(new Date(iso))
}

/** An open-ended range reads as "from X" rather than "X – null". */
export function formatDateRange(startIso: string, endIso: string | null): string {
  return endIso ? `${formatDate(startIso)} – ${formatDate(endIso)}` : `From ${formatDate(startIso)}`
}

/** Indian formatting, no decimals: salaries are read at a glance, not audited here. */
const MONEY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return MONEY.format(amount)
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  return `${hours.toFixed(2)} h`
}

/** ISO timestamp -> the value an <input type="date"> expects. */
export function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

/** ISO timestamp -> the value an <input type="datetime-local"> expects. */
export function toDateTimeInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : ''
}

/**
 * Is this contract the one in force today?
 *
 * A presentation-only convenience for highlighting a row (spec A2). The
 * authoritative answer for payroll comes from ContractQueryPort, never from here.
 */
export function isCurrentContract(start: string, end: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return start.slice(0, 10) <= today && (end === null || end.slice(0, 10) >= today)
}
