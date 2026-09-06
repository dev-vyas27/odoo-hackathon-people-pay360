/**
 * Deterministic UUIDs — the reason three people can seed one database without
 * running each other's code.
 *
 * Dev B's employee #7 is always `656d7000-0000-4000-8000-000000000007`. Dev C's
 * payslip can reference it, and my allocation can reference it, and neither of
 * us has to seed first or hand ids back through a return value. Re-running the
 * seed produces byte-identical ids, which is what makes `ON CONFLICT (id) DO
 * UPDATE` idempotent and what lets a rehearsed demo URL keep working.
 *
 * The encoding is legible on purpose. The first group is the ASCII of the kind,
 * so `656d7000-...` reads as "emp" in psql and a dangling foreign key tells you
 * what it was supposed to point at. The version (`4`) and variant (`8`) nibbles
 * are set so these are well-formed UUIDs — Postgres rejects anything else, and
 * the shared `uuid` zod schema validates the same shape at the API edge.
 */

export type SeedKind =
  | 'usr' // Dev A — users
  | 'emp' // Dev B — employees
  | 'dep' // Dev B — departments
  | 'job' // Dev B — job positions
  | 'con' // Dev B — contracts
  | 'sch' // Dev B — working schedules
  | 'att' // Dev B — attendances
  | 'tot' // Dev A — timeoff types
  | 'alc' // Dev A — timeoff allocations
  | 'lvr' // Dev A — timeoff requests
  | 'rul' // Dev C — salary rules
  | 'str' // Dev C — salary structures
  | 'run' // Dev C — payruns
  | 'psl' // Dev C — payslips

/**
 * `seedId('emp', 7)` -> '656d7000-0000-4000-8000-000000000007'
 *
 * Twelve hex digits for the index is more room than any seed will ever need.
 */
export function seedId(kind: SeedKind, index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`seedId index must be a non-negative integer, got ${index}`)
  }

  // 3 ASCII characters = 6 hex digits, padded to the 8 the first group needs.
  const prefix = Buffer.from(kind, 'ascii').toString('hex').padEnd(8, '0')
  const suffix = index.toString(16).padStart(12, '0')

  if (suffix.length > 12) {
    throw new Error(`seedId index ${index} is too large to encode`)
  }

  // '4' = version 4, '8' = RFC 4122 variant. Postgres validates both.
  return `${prefix}-0000-4000-8000-${suffix}`
}

/** `seedIds('emp', 3)` -> the first three employee ids. */
export function seedIds(kind: SeedKind, count: number): string[] {
  return Array.from({ length: count }, (_, i) => seedId(kind, i + 1))
}

/**
 * The fixed cast for the demo. Named constants rather than magic indexes,
 * because `SEED.users.hrManager` survives someone inserting a row and
 * `seedId('usr', 3)` does not.
 */
export const SEED = {
  users: {
    admin: seedId('usr', 1),
    hrManager: seedId('usr', 2),
    payrollUser: seedId('usr', 3),
    payrollManager: seedId('usr', 4),
    employee: seedId('usr', 5),
  },
  departments: {
    engineering: seedId('dep', 1),
    sales: seedId('dep', 2),
    operations: seedId('dep', 3),
    /**
     * The department the staff logins belong to.
     *
     * Since 0010 an account is an employee row, so the HR and payroll people
     * appear on the employee list like anyone else. Without a department they
     * read as half-created records — a dash where every other row has a name.
     * They are real staff; this is where they work.
     */
    humanResources: seedId('dep', 4),
  },
  schedules: {
    standard40: seedId('sch', 1),
    partTime20: seedId('sch', 2),
  },
  timeOffTypes: {
    paid: seedId('tot', 1),
    sick: seedId('tot', 2),
    unpaid: seedId('tot', 3),
  },
  /**
   * Employee 1 is the demo's protagonist and employee 2 is the one with an
   * expired contract plus a current one — that pair is what proves
   * period-based contract selection live on stage. Dev B: please keep those
   * two indexes meaning those two things.
   */
  employees: {
    demoLead: seedId('emp', 1),
    twoContracts: seedId('emp', 2),
  },
} as const
