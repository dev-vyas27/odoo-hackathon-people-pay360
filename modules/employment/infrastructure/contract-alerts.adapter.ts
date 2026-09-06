

import { query } from '@/lib/db'
import type { ContractAlert, ContractAlertsPort, Period } from '@/modules/shared'
import { NOT_AN_ADMIN } from '@/modules/people'

const d = (value: Date) => value.toISOString().slice(0, 10)

export class PostgresContractAlerts implements ContractAlertsPort {
  async attentionItems(period: Period, withinDays: number): Promise<ContractAlert[]> {
    

    const rows = await query<{
      contract_id: string | null
      employee_id: string
      employee_name: string
      ends_on: Date | null
      kind: ContractAlert['kind']
    }>(
      `SELECT c.id AS contract_id, e.id AS employee_id, e.name AS employee_name,
              c.ends_on,
              CASE WHEN c.ends_on < $1::date THEN 'expired' ELSE 'expiring' END AS kind
         FROM contracts c
         JOIN employees e ON e.id = c.employee_id
        WHERE c.status = 'active'
          AND e.is_active = true
          AND e.${NOT_AN_ADMIN}
          AND c.ends_on IS NOT NULL
          AND c.ends_on <= ($2::date + ($3 || ' days')::interval)

        UNION ALL

       SELECT NULL, e.id, e.name, NULL, 'missing'
         FROM employees e
        WHERE e.is_active = true
          -- An administrator operates the system rather than being paid by it,
          -- so it has no contract and never will. Without this the alert opens
          -- every day reporting a problem nobody can fix, which is how a work
          -- queue stops being read.
          AND e.${NOT_AN_ADMIN}
          AND NOT EXISTS (
            SELECT 1 FROM contracts c2
             WHERE c2.employee_id = e.id
               AND c2.status = 'active'
               AND c2.starts_on <= $2::date
               AND (c2.ends_on IS NULL OR c2.ends_on >= $1::date)
          )
        ORDER BY employee_name ASC`,
      [d(period.start), d(period.end), String(withinDays)],
    )

    return rows.map((r) => ({
      contractId: r.contract_id ?? '',
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      kind: r.kind,
      endsOn: r.ends_on,
      issue:
        r.kind === 'missing'
          ? 'No active contract covers this period'
          : r.kind === 'expired'
            ? 'Contract expired during this period'
            : `Contract ends ${r.ends_on ? d(r.ends_on) : 'soon'}`,
    }))
  }
}
