import { describe, expect, it } from 'vitest'
import { Money } from './money'

describe('Money', () => {
  it('stores minor units so float error cannot accumulate', () => {
    // The classic failure: 0.1 + 0.2 === 0.30000000000000004
    const total = Money.of(0.1).plus(Money.of(0.2))
    expect(total.toNumber()).toBe(0.3)
  })

  it('sums a payslip line-up exactly', () => {
    const lines = [Money.of(45000), Money.of(3200.5), Money.of(1800.25)]
    expect(Money.sum(lines).toNumber()).toBe(50000.75)
  })

  it('computes a percentage deduction', () => {
    expect(Money.of(50000).percentage(12).toNumber()).toBe(6000)
  })

  it('prorates by worked-days ratio, rounding once', () => {
    // 22 of 30 days on a 50,000 basic
    expect(Money.of(50000).times(22 / 30).toNumber()).toBe(36666.67)
  })

  it('refuses to mix currencies', () => {
    expect(() => Money.of(10, 'INR').plus(Money.of(10, 'USD'))).toThrow(
      /Cannot combine INR with USD/,
    )
  })

  it('treats deductions as negative and nets correctly', () => {
    const gross = Money.of(60000)
    const deduction = Money.of(7200).negated()
    expect(gross.plus(deduction).toNumber()).toBe(52800)
  })
})
