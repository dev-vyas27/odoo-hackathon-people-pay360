/**
 * Money — integer minor units (paise/cents). Immutable.
 *
 * Payroll must never use floats: 0.1 + 0.2 !== 0.3 and a rounding drift of one
 * paise across 500 payslips is a reconciliation bug nobody can find at 3am.
 * All arithmetic here is integer arithmetic; rounding happens once, explicitly.
 */
import { DomainError } from './domain-error'

export class Money {
  private constructor(
    readonly minor: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency = 'INR'): Money {
    if (!Number.isFinite(amount)) {
      throw DomainError.validation('MONEY_NOT_FINITE', `Amount is not a finite number: ${amount}`)
    }
    return new Money(Math.round(amount * 100), currency)
  }

  static fromMinor(minor: number, currency = 'INR'): Money {
    if (!Number.isInteger(minor)) {
      throw DomainError.validation('MONEY_NOT_INTEGER', `Minor units must be an integer: ${minor}`)
    }
    return new Money(minor, currency)
  }

  static zero(currency = 'INR'): Money {
    return new Money(0, currency)
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw DomainError.rule(
        'MONEY_CURRENCY_MISMATCH',
        `Cannot combine ${this.currency} with ${other.currency}`,
      )
    }
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.minor + other.minor, this.currency)
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.minor - other.minor, this.currency)
  }

  /** Multiply by a plain ratio (e.g. worked-days proration). Rounds half-up once. */
  times(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw DomainError.validation('MONEY_BAD_FACTOR', `Factor is not finite: ${factor}`)
    }
    return new Money(Math.round(this.minor * factor), this.currency)
  }

  /** percentage(12.5) => 12.5% of this amount. */
  percentage(percent: number): Money {
    return this.times(percent / 100)
  }

  negated(): Money {
    return new Money(-this.minor, this.currency)
  }

  abs(): Money {
    return new Money(Math.abs(this.minor), this.currency)
  }

  isZero(): boolean {
    return this.minor === 0
  }
  isNegative(): boolean {
    return this.minor < 0
  }
  equals(other: Money): boolean {
    return this.minor === other.minor && this.currency === other.currency
  }
  compare(other: Money): number {
    this.assertSameCurrency(other)
    return this.minor - other.minor
  }

  /** Decimal major units — for display and for persisting a queryable number. */
  toNumber(): number {
    return this.minor / 100
  }

  toJSON(): number {
    return this.toNumber()
  }

  format(locale = 'en-IN'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.toNumber())
  }

  static sum(items: Money[], currency = 'INR'): Money {
    return items.reduce((acc, m) => acc.plus(m), Money.zero(currency))
  }
}
