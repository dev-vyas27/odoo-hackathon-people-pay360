

import { DomainError } from './domain-error'

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const MS_PER_DAY = 86_400_000

export class Period {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static of(start: Date, end: Date): Period {
    const s = startOfDay(start)
    const e = startOfDay(end)
    if (e.getTime() < s.getTime()) {
      throw DomainError.validation(
        'PERIOD_END_BEFORE_START',
        `Period end (${e.toISOString()}) is before start (${s.toISOString()})`,
      )
    }
    return new Period(s, e)
  }

  
  static month(year: number, month: number): Period {
    if (month < 1 || month > 12) {
      throw DomainError.validation('PERIOD_BAD_MONTH', `Month must be 1-12, got ${month}`)
    }
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0)) 
    return new Period(start, end)
  }

  
  contains(date: Date): boolean {
    const t = startOfDay(date).getTime()
    return t >= this.start.getTime() && t <= this.end.getTime()
  }

  
  overlaps(other: Period): boolean {
    return this.start.getTime() <= other.end.getTime() && other.start.getTime() <= this.end.getTime()
  }

  
  intersection(other: Period): Period | null {
    if (!this.overlaps(other)) return null
    const s = this.start.getTime() > other.start.getTime() ? this.start : other.start
    const e = this.end.getTime() < other.end.getTime() ? this.end : other.end
    return new Period(s, e)
  }

  
  get days(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / MS_PER_DAY) + 1
  }

  
  eachDay(): Date[] {
    const out: Date[] = []
    for (let t = this.start.getTime(); t <= this.end.getTime(); t += MS_PER_DAY) {
      out.push(new Date(t))
    }
    return out
  }

  equals(other: Period): boolean {
    return this.start.getTime() === other.start.getTime() && this.end.getTime() === other.end.getTime()
  }

  toString(): string {
    return `${this.start.toISOString().slice(0, 10)}..${this.end.toISOString().slice(0, 10)}`
  }

  toJSON() {
    return { start: this.start.toISOString(), end: this.end.toISOString() }
  }
}
