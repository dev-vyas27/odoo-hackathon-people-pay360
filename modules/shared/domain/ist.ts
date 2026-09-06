




export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export const IST_LABEL = 'IST'



function istView(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MS)
}


export function istDay(instant: Date = new Date()): string {
  return istView(instant).toISOString().slice(0, 10)
}


export function istTime(instant: Date = new Date()): string {
  return istView(instant).toISOString().slice(11, 16)
}


function fromIstParts(day: string, hours: number, minutes: number, seconds = 0): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, hours, minutes, seconds) - IST_OFFSET_MS)
}


export function istStartOfDay(day: string): Date {
  return fromIstParts(day, 0, 0)
}



export function istEndOfDay(day: string): Date {
  return fromIstParts(day, 23, 59, 59)
}


export function istNextMidnight(instant: Date = new Date()): Date {
  return new Date(istStartOfDay(istDay(instant)).getTime() + 24 * 60 * 60 * 1000)
}


export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))
}


export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}
