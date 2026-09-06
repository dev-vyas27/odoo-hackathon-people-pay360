





const ZONE = 'Asia/Kolkata'

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: ZONE,
})

const TIME = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: ZONE,
})

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATE.format(new Date(iso))
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return TIME.format(new Date(iso))
}


export function formatDateRange(startIso: string, endIso: string | null): string {
  return endIso ? `${formatDate(startIso)} – ${formatDate(endIso)}` : `From ${formatDate(startIso)}`
}


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


export function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}


export function toDateTimeInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : ''
}



export function isCurrentContract(start: string, end: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return start.slice(0, 10) <= today && (end === null || end.slice(0, 10) >= today)
}
