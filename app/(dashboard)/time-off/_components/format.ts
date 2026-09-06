



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


export function formatDuration(duration: number, unit: 'day' | 'hour'): string {
  const amount = Number.isInteger(duration) ? String(duration) : duration.toFixed(1)
  const plural = duration === 1 ? unit : `${unit}s`
  return `${amount} ${plural}`
}


export function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}
