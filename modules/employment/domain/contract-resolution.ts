

import { Period, startOfDay } from '@/modules/shared'

export interface ContractRange {
  readonly start: Date
  readonly end: Date | null
}

function rangeEnd(range: ContractRange): number {
  return range.end ? startOfDay(range.end).getTime() : Number.POSITIVE_INFINITY
}

function rangeStart(range: ContractRange): number {
  return startOfDay(range.start).getTime()
}

export function contractsOverlap(a: ContractRange, b: ContractRange): boolean {
  return rangeStart(a) <= rangeEnd(b) && rangeStart(b) <= rangeEnd(a)
}

function overlapsPeriod(range: ContractRange, period: Period): boolean {
  return rangeStart(range) <= period.end.getTime() && period.start.getTime() <= rangeEnd(range)
}

function coversPeriodEnd(range: ContractRange, period: Period): boolean {
  return rangeStart(range) <= period.end.getTime() && period.end.getTime() <= rangeEnd(range)
}

export function resolveApplicableContract<T extends ContractRange>(
  contracts: readonly T[],
  period: Period,
): T | null {
  const candidates = contracts.filter((c) => overlapsPeriod(c, period))
  if (candidates.length === 0) return null

  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (isPreferred(candidate, best, period)) best = candidate
  }
  return best
}

function isPreferred<T extends ContractRange>(candidate: T, current: T, period: Period): boolean {
  const candidateCovers = coversPeriodEnd(candidate, period)
  const currentCovers = coversPeriodEnd(current, period)
  if (candidateCovers !== currentCovers) return candidateCovers
  return rangeStart(candidate) > rangeStart(current)
}
