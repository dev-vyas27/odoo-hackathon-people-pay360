/**
 * The contract plan: who is paid what, under which contract, over which dates.
 *
 * Shared by `employment.seed` (which writes the contracts) and
 * `payroll-processing.seed` (which has to record, on every payslip, the
 * contract it was computed from and the wage that contract carried at the
 * time). Those two used to hold parallel copies of the same table joined by a
 * comment reading "must match employment.seed.ts" — a comment that is one edit
 * away from being a lie. Deriving both from here removes the possibility.
 */
import { seedId } from './ids'
import { ACTIVE_ROSTER, ROSTER, type RosterPerson } from './roster'

export interface PlannedContract {
  id: string
  employeeId: string
  wage: number
  scheduleId: string
  startsOn: string
  /** null = open-ended. */
  endsOn: string | null
  status: 'active' | 'expired'
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/** The first of the month, `back` months before the current one. */
function monthStart(back: number): Date {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1))
}

/** The last day of the month, `back` months before the current one. */
function monthEnd(back: number): Date {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back + 1, 0))
}

/**
 * The employee whose contract history proves period-based selection.
 *
 * Their old contract ends three months ago and a new one begins the next day at
 * a higher wage. The seeded payruns cover the last four months, so the oldest
 * payslip MUST come out at the old figure and the rest at the new one. If a
 * recompute moves that oldest number, contract selection is reading the wrong
 * row — which makes this pair a live assertion, not just demo colour.
 */
const RAISE_MONTHS_AGO = 3

/**
 * Contracts that expire inside the dashboard's 60-day attention window.
 *
 * Three, not one: a single alert row looks like a special case, and the panel
 * is meant to read as a work queue.
 */
const ENDING_SOON_COUNT = 3

function buildPlan(): PlannedContract[] {
  const contracts: PlannedContract[] = []
  let sequence = 1
  const next = () => seedId('con', sequence++)

  const today = new Date()
  const twoContracts = ACTIVE_ROSTER[1]

  /**
   * Who gets a contract expiring soon: three mid-level people spread across
   * departments, chosen by position in the roster so the choice is stable
   * across runs and never lands on a department head.
   */
  const endingSoon = new Set(
    ACTIVE_ROSTER.filter((person) => person.level === 'mid' || person.level === 'junior')
      .filter((_, i) => i % 23 === 5)
      .slice(0, ENDING_SOON_COUNT)
      .map((person) => person.id),
  )

  for (const person of ROSTER) {
    /**
     * Hire date, spread over roughly four years so the "started this year" and
     * "here since the beginning" cases both exist. Derived from the index
     * rather than randomly, so it never moves between runs.
     */
    const tenureMonths = 3 + ((person.index * 7) % 45)
    const hiredOn = monthStart(tenureMonths)

    // Archived people left; their contract ended and is history.
    if (!person.isActive) {
      contracts.push({
        id: next(),
        employeeId: person.id,
        wage: person.wage,
        scheduleId: person.scheduleId,
        startsOn: iso(hiredOn),
        endsOn: iso(monthEnd(2)),
        status: 'expired',
      })
      continue
    }

    if (person.id === twoContracts.id) {
      // The historical contract, at a lower wage. See RAISE_MONTHS_AGO.
      const previousEnd = monthEnd(RAISE_MONTHS_AGO)
      contracts.push({
        id: next(),
        employeeId: person.id,
        wage: Math.round((person.wage * 0.78) / 500) * 500,
        scheduleId: person.scheduleId,
        startsOn: iso(hiredOn),
        endsOn: iso(previousEnd),
        status: 'expired',
      })
      contracts.push({
        id: next(),
        employeeId: person.id,
        wage: person.wage,
        scheduleId: person.scheduleId,
        startsOn: iso(monthStart(RAISE_MONTHS_AGO - 1)),
        endsOn: null,
        status: 'active',
      })
      continue
    }

    const endsSoon = endingSoon.has(person.id)
    contracts.push({
      id: next(),
      employeeId: person.id,
      wage: person.wage,
      scheduleId: person.scheduleId,
      startsOn: iso(hiredOn),
      endsOn: endsSoon
        ? iso(
            new Date(
              Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 24),
            ),
          )
        : null,
      status: 'active',
    })
  }

  return contracts
}

export const CONTRACT_PLAN: PlannedContract[] = buildPlan()

/**
 * The contract covering `date` for this employee, or null.
 *
 * This is the same question `payslips.contract_id` answers, and answering it
 * here the same way is what keeps the seeded history consistent with what a
 * recompute would produce.
 */
export function contractOn(employeeId: string, date: string): PlannedContract | null {
  const candidates = CONTRACT_PLAN.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      contract.startsOn <= date &&
      (contract.endsOn === null || contract.endsOn >= date),
  )
  // An active contract wins over an expired one on the same day, which only
  // happens on a boundary.
  return candidates.find((c) => c.status === 'active') ?? candidates[0] ?? null
}

export const CONTRACT_BY_EMPLOYEE = new Map<string, PlannedContract[]>()
for (const contract of CONTRACT_PLAN) {
  const list = CONTRACT_BY_EMPLOYEE.get(contract.employeeId) ?? []
  list.push(contract)
  CONTRACT_BY_EMPLOYEE.set(contract.employeeId, list)
}

export type { RosterPerson }
