/**
 * Postgres implementation of StructureEmployeeCountPort.
 *
 * Reads the `contracts` table directly — owned by modules/employment, not
 * this module — the same way employment's own contract-query.adapter.ts
 * reads `employees` (owned by modules/people) and payroll-processing's
 * payroll-stats.adapter.ts does the same. See the port file for why this is
 * the right cross-module pattern here instead of going through a port that
 * does not exist yet.
 *
 * "Currently active" = status = 'active' AND today's date falls inside the
 * contract's validity range (open-ended when `ends_on` is null). Grouped and
 * counted with COUNT(DISTINCT employee_id) so a structure never gets credited
 * twice for one employee, and batched across the whole page of structures in
 * one query rather than one query per structure.
 */
import { query } from '@/lib/db'
import type { StructureEmployeeCountPort } from '../application/ports/structure-employee-count.port'

interface CountRow {
  salary_structure_id: string
  employee_count: number
}

export class PostgresStructureEmployeeCount implements StructureEmployeeCountPort {
  async countByStructure(structureIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (!structureIds.length) return counts

    const rows = await query<CountRow>(
      `SELECT salary_structure_id, COUNT(DISTINCT employee_id)::int AS employee_count
         FROM contracts
        WHERE status = 'active'
          AND starts_on <= CURRENT_DATE
          AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
          AND salary_structure_id = ANY($1)
        GROUP BY salary_structure_id`,
      [structureIds],
    )

    for (const row of rows) counts.set(row.salary_structure_id, row.employee_count)
    return counts
  }
}
