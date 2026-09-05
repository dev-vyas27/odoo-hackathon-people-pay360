/**
 * Leave types, entitlements and a year of requests.
 *
 * Owner: Dev A.
 *
 * Dates are anchored to the CURRENT year rather than a hardcoded one. A demo
 * whose leave balances all expired last year looks broken; the ids stay fixed,
 * so the seed is still idempotent even though the dates move.
 *
 * ── The balance has to add up ──────────────────────────────────────────────
 *
 * `timeoff_allocations.taken` is a stored counter, and the schema has a CHECK
 * that it never exceeds `allocated`. So requests are generated FIRST and the
 * counter is derived from the approved ones, rather than both being written
 * independently and hoping they agree. A seed that violates its own invariants
 * is worse than no seed — it teaches you to distrust the constraint.
 */
import { seedId } from '../ids'
import { ACTIVE_ROSTER, STAFF } from '../roster'
import { SEED } from '../ids'
import type { SeedPart, SeedRow } from '../types'

/** `date` columns take 'YYYY-MM-DD'. No time, no zone, no ambiguity. */
const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`

const TYPES = {
  paid: SEED.timeOffTypes.paid,
  sick: SEED.timeOffTypes.sick,
  unpaid: SEED.timeOffTypes.unpaid,
  casual: seedId('tot', 4),
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REASONS = {
  paid: ['Family holiday', 'Annual leave', 'Wedding in the family', 'Travel', 'Personal time'],
  sick: ['Fever', 'Recovering from flu', 'Medical procedure', 'Migraine', 'Dental surgery'],
  casual: ['Personal errand', 'House move', 'Family commitment', 'Bank work'],
  unpaid: ['Extended personal leave', 'Sabbatical request', 'Unpaid family leave'],
}

export const timeoffSeed: SeedPart = {
  name: 'timeoff',
  // Parents first; --reset empties them in reverse. See SeedPart.tables.
  tables: ['timeoff_types', 'timeoff_allocations', 'timeoff_requests'],
  async run(ctx) {
    const year = new Date().getUTCFullYear()
    const thisMonth = new Date().getUTCMonth() + 1
    const random = makeRng(4_820_260_9 >>> 0)

    const types = await ctx.upsert('timeoff_types', [
      { id: TYPES.paid, name: 'Paid Time Off', code: 'PL', unit: 'day', requires_allocation: true, is_paid: true, is_active: true },
      { id: TYPES.sick, name: 'Sick Leave', code: 'SL', unit: 'day', requires_allocation: true, is_paid: true, is_active: true },
      { id: TYPES.casual, name: 'Casual Leave', code: 'CL', unit: 'day', requires_allocation: true, is_paid: true, is_active: true },
      {
        /**
         * The interesting one: no allocation, so it can never overdraw, and
         * unpaid, so payroll prorates against it. It is the counter-example
         * that proves the flags do something.
         */
        id: TYPES.unpaid, name: 'Unpaid Leave', code: 'UL', unit: 'day', requires_allocation: false, is_paid: false, is_active: true,
      },
    ])
    ctx.log(`${types} leave types`)

    // ── entitlements ────────────────────────────────────────────────────────
    interface Allocation { id: string; employeeId: string; typeId: string; allocated: number; taken: number }
    const allocations: Allocation[] = []
    const allocationFor = new Map<string, Allocation>()
    let allocationSeq = 1

    for (const person of ACTIVE_ROSTER) {
      // Paid leave scales a little with seniority, the way it actually does.
      const paidDays = person.level === 'intern' ? 8 : person.level === 'junior' ? 18 : 22
      const grants: Array<[string, number]> = [
        [TYPES.paid, paidDays],
        [TYPES.sick, 10],
      ]
      // Casual leave is a subset — not every contract carries it.
      if (random() < 0.45) grants.push([TYPES.casual, 6])

      for (const [typeId, allocated] of grants) {
        const allocation: Allocation = {
          id: seedId('alc', allocationSeq++),
          employeeId: person.id,
          typeId,
          allocated,
          taken: 0,
        }
        allocations.push(allocation)
        allocationFor.set(`${person.id}:${typeId}`, allocation)
      }
    }

    // ── requests ────────────────────────────────────────────────────────────
    const requests: SeedRow[] = []
    let requestSeq = 1
    const counts: Record<string, number> = { approved: 0, to_approve: 0, refused: 0 }

    /**
     * Roughly two thirds of the company has taken or asked for leave this year,
     * and about a third of those more than once. At a lower rate the Time Off
     * screens open on a nearly empty table, which makes a 170-person company
     * look like nobody in it ever takes a holiday.
     */
    for (const person of ACTIVE_ROSTER) {
      const attempts = random() < 0.66 ? (random() < 0.38 ? 2 : 1) : 0

      for (let n = 0; n < attempts; n += 1) {
        const roll = random()
        const kind: keyof typeof REASONS =
          roll < 0.45 ? 'paid' : roll < 0.75 ? 'sick' : roll < 0.92 ? 'casual' : 'unpaid'
        const typeId = TYPES[kind]
        const allocation = allocationFor.get(`${person.id}:${typeId}`)

        // No entitlement for this type and it needs one — skip rather than
        // write a request the approval flow could never fund.
        if (kind !== 'unpaid' && !allocation) continue

        const duration = kind === 'unpaid' ? 5 + Math.floor(random() * 20) : 1 + Math.floor(random() * 4)

        /**
         * Status decides WHEN it happens. Pending leave in the past is
         * nonsense — an approvals queue full of requests for last March reads
         * as a system nobody is using.
         */
        const statusRoll = random()
        const status = statusRoll < 0.58 ? 'approved' : statusRoll < 0.85 ? 'to_approve' : 'refused'

        /**
         * Decided leave lands anywhere from January up to and INCLUDING this
         * month; pending leave is always ahead of today.
         *
         * The upper bound matters more than it looks: the dashboard's
         * "Approved time off" tile is filtered to the selected period, so
         * stopping at last month made it read a flat zero on a system with
         * eighty approved requests in it.
         */
        const month =
          status === 'to_approve'
            ? Math.min(12, thisMonth + Math.floor(random() * 3))
            : 1 + Math.floor(random() * thisMonth)

        const start = 1 + Math.floor(random() * 20)
        const startsOn = day(year, month, start)
        const endsOn = day(year, month, Math.min(28, start + duration - 1))

        // An approved request must record where its days came from, and must
        // not overdraw the balance — both are CHECK constraints.
        let fundedBy: string | null = null
        if (status === 'approved' && allocation) {
          if (allocation.taken + duration > allocation.allocated) continue
          allocation.taken += duration
          fundedBy = allocation.id
        } else if (status === 'approved' && kind === 'unpaid') {
          // Unpaid leave needs no allocation, but the constraint still wants a
          // decision recorded — see requests_approved_has_decision.
          fundedBy = null
        }

        counts[status] += 1

        requests.push({
          id: seedId('lvr', requestSeq++),
          employee_id: person.id,
          timeoff_type_id: typeId,
          starts_on: startsOn,
          ends_on: endsOn,
          unit: 'day',
          duration,
          reason: REASONS[kind][Math.floor(random() * REASONS[kind].length)],
          status,
          allocation_id: fundedBy,
          decided_by_employee_id: status === 'to_approve' ? null : STAFF.hrManager.id,
          decided_at:
            status === 'to_approve' ? null : new Date(Date.UTC(year, Math.max(0, month - 2), 18)),
        })
      }
    }

    const writtenAllocations = await ctx.upsert(
      'timeoff_allocations',
      allocations.map((allocation) => ({
        id: allocation.id,
        employee_id: allocation.employeeId,
        timeoff_type_id: allocation.typeId,
        unit: 'day',
        allocated: allocation.allocated,
        taken: allocation.taken,
        valid_from: day(year, 1, 1),
        valid_to: day(year, 12, 31),
        status: 'approved',
        note: 'Annual entitlement',
      })),
    )
    ctx.log(`${writtenAllocations} allocations across ${ACTIVE_ROSTER.length} employees`)

    const writtenRequests = await ctx.upsert('timeoff_requests', requests)
    ctx.log(
      `${writtenRequests} leave requests — ${counts.approved} approved, ` +
        `${counts.to_approve} awaiting a decision, ${counts.refused} refused`,
    )
  },
}
