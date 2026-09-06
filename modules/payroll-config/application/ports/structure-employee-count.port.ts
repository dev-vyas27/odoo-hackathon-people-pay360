/**
 * StructureEmployeeCountPort — how many employees are currently attached to
 * each salary structure (spec A5: the Structures list/detail views must show
 * this alongside rule count and active status).
 *
 * DEFINITION (genuinely ambiguous, so spelled out here): a structure is only
 * reachable through a contract's `salaryStructureId`, and one employee can
 * carry several historical contracts that point at DIFFERENT structures over
 * time (a promotion, a pay revision, ...). Counting every contract row would
 * double-count that employee against every structure they ever passed
 * through. So "employees using this structure" is defined as the number of
 * DISTINCT employees whose CURRENTLY ACTIVE contract — status = 'active' AND
 * today falls inside its validity range — references the structure. A
 * contract that used to point here, or will in the future, does not count;
 * only the one contract in force today does, and an employee can have at
 * most one of those (the database's EXCLUDE constraint on active contracts
 * guarantees it).
 *
 * `contracts` is owned by modules/employment, not this module. This is NOT
 * exposed via the cross-module port container (PORT_KEYS / providePort):
 * `ContractQueryPort` (the port employment actually publishes) is
 * per-employee only (`findApplicableContract`, `findByEmployee`) and has no
 * bulk "count by structure" query, so there is nothing to consume there
 * without adding a method to a file this module does not own
 * (modules/shared/contracts/dto.ts + modules/employment/**). Instead this
 * follows the OTHER established cross-module pattern already used twice in
 * this codebase: a module's own Postgres adapter reads another module's
 * table directly by name (no import of that module's code) — see
 * modules/employment/infrastructure/contract-query.adapter.ts joining the
 * `employees` table it does not own, and
 * modules/payroll-processing/infrastructure/payroll-stats.adapter.ts doing
 * the same. The ESLint boundary rule bans cross-module IMPORTS, not SQL
 * against shared tables in the one Postgres schema every module lives in.
 */
export interface StructureEmployeeCountPort {
  /** Distinct active-contract employee count per structure id, batched for a page of structures. */
  countByStructure(structureIds: string[]): Promise<Map<string, number>>
}
