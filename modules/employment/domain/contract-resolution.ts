/**
 * Contract resolution — spec A2, the single most important rule in the module.
 *
 * PURE. No I/O, no framework, no Mongoose. Payroll asks "which contract
 * applies to this payroll period for this employee" and gets back either a
 * contract or `null`. `null` is a legitimate, expected answer (Payroll turns
 * it into a warning) — this file never throws for "no contract found".
 */
import { Period, startOfDay } from '@/modules/shared'

/** The only shape resolution needs: a validity range, open-ended when `end` is null. */
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

/**
 * True when two (possibly open-ended) validity ranges share at least one
 * calendar day. Used both by resolution (range vs. payroll period) and by
 * write-time overlap prevention (range vs. range).
 */
export function contractsOverlap(a: ContractRange, b: ContractRange): boolean {
  return rangeStart(a) <= rangeEnd(b) && rangeStart(b) <= rangeEnd(a)
}

/** A contract's range, expressed as a period, overlaps the payroll period. */
function overlapsPeriod(range: ContractRange, period: Period): boolean {
  return rangeStart(range) <= period.end.getTime() && period.start.getTime() <= rangeEnd(range)
}

/** The contract's validity range extends through (or past) the period's last day. */
function coversPeriodEnd(range: ContractRange, period: Period): boolean {
  return rangeStart(range) <= period.end.getTime() && period.end.getTime() <= rangeEnd(range)
}

/**
 * Resolve which single contract applies to `period` for one employee.
 *
 * Rules (spec A2):
 * 1. Only contracts whose validity range overlaps the payroll period are candidates.
 * 2. Among candidates, prefer the one covering the period's END date.
 * 3. Tie-break on the latest `start`.
 * 4. No overlapping contract at all -> `null` (not an error).
 *
 * Callers pass in whatever contract-shaped objects they have (a
 * `ContractSnapshot`, a domain `Contract`, a test fixture) as long as they
 * carry `start`/`end`.
 */
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
