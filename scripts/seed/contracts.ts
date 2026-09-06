

import { seedId } from './ids'
import { ACTIVE_ROSTER, ROSTER, type RosterPerson } from './roster'

export interface PlannedContract {
  id: string
  employeeId: string
  wage: number
  scheduleId: string
  startsOn: string
  
  endsOn: string | null
  status: 'active' | 'expired'
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

function monthStart(back: number): Date {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1))
}

function monthEnd(back: number): Date {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back + 1, 0))
}

const RAISE_MONTHS_AGO = 3

const ENDING_SOON_COUNT = 3

function buildPlan(): PlannedContract[] {
  const contracts: PlannedContract[] = []
  let sequence = 1
  const next = () => seedId('con', sequence++)

  const today = new Date()
  const twoContracts = ACTIVE_ROSTER[1]

  

  const endingSoon = new Set(
    ACTIVE_ROSTER.filter((person) => person.level === 'mid' || person.level === 'junior')
      .filter((_, i) => i % 23 === 5)
      .slice(0, ENDING_SOON_COUNT)
      .map((person) => person.id),
  )

  for (const person of ROSTER) {
    

    const tenureMonths = 3 + ((person.index * 7) % 45)
    const hiredOn = monthStart(tenureMonths)

    
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

export function contractOn(employeeId: string, date: string): PlannedContract | null {
  const candidates = CONTRACT_PLAN.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      contract.startsOn <= date &&
      (contract.endsOn === null || contract.endsOn >= date),
  )
  
  
  return candidates.find((c) => c.status === 'active') ?? candidates[0] ?? null
}

export const CONTRACT_BY_EMPLOYEE = new Map<string, PlannedContract[]>()
for (const contract of CONTRACT_PLAN) {
  const list = CONTRACT_BY_EMPLOYEE.get(contract.employeeId) ?? []
  list.push(contract)
  CONTRACT_BY_EMPLOYEE.set(contract.employeeId, list)
}

export type { RosterPerson }
