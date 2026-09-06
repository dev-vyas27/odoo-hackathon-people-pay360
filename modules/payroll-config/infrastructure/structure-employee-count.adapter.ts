

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
