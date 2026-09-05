/**
 * Delete the rows the Playwright QA suite created, and nothing else.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/clean-qa-data.mts          # dry run
 *   npx tsx --env-file-if-exists=.env.local scripts/clean-qa-data.mts --apply  # delete
 *
 * The suite creates every record it touches rather than leaning on the seed, so
 * it leaves a lot behind. Everything it makes is marked:
 *
 *   people (and their logins, which are the same row since 0010)
                       email ends in @peoplepay360.test   (the seed uses .dev)
 *   everything else     a name prefix from tests/e2e/_helpers/fixtures.ts
 *
 * Deletes run child-first so no foreign key is ever left dangling. Dry run is
 * the default on purpose: this removes data, and the counts are worth reading
 * before anyone does that.
 */
import { query, transaction, closePool } from '@/lib/db'

const QA_EMAIL = `'%@peoplepay360.test'`

/** Employees and logins the suite minted, as a reusable subquery. */
const QA_EMPLOYEES = `SELECT id FROM employees WHERE email LIKE ${QA_EMAIL}`
const QA_PAYRUNS =
  `SELECT id FROM payruns WHERE name LIKE 'Payrun%' OR name LIKE 'RegPayrun-%'
     OR name LIKE 'SendRun-%' OR name LIKE 'Send Test%'`
const QA_STRUCTURES =
  `SELECT id FROM salary_structures WHERE name LIKE 'Struct-%' OR name LIKE 'RegStruct-%'
     OR name LIKE 'SendStruct%'`

/**
 * Child-first. `payslip_lines` and `salary_structure_rules` cascade from their
 * parents, so they are not listed — deleting the parent takes them.
 */
const STEPS: Array<[label: string, sql: string]> = [
  ['payslips (QA payruns)', `DELETE FROM payslips WHERE payrun_id IN (${QA_PAYRUNS})`],
  ['payslips (QA employees)', `DELETE FROM payslips WHERE employee_id IN (${QA_EMPLOYEES})`],
  ['payrun_employees (QA payruns)', `DELETE FROM payrun_employees WHERE payrun_id IN (${QA_PAYRUNS})`],
  /**
   * And by employee. `payrun_employees.employee_id` is ON DELETE RESTRICT, so a
   * QA employee selected into a payrun that survives this clean would block the
   * employee delete outright — which is exactly what happened the first time.
   */
  [
    'payrun_employees (QA employees)',
    `DELETE FROM payrun_employees WHERE employee_id IN (${QA_EMPLOYEES})`,
  ],
  ['payruns', `DELETE FROM payruns WHERE id IN (${QA_PAYRUNS})`],
  ['salary_structures', `DELETE FROM salary_structures WHERE id IN (${QA_STRUCTURES})`],
  [
    'salary_rules',
    `DELETE FROM salary_rules WHERE name LIKE 'Rule-%' OR name LIKE 'RegBasic-%'
       OR name LIKE 'SendBasic%'`,
  ],
  ['timeoff_requests', `DELETE FROM timeoff_requests WHERE employee_id IN (${QA_EMPLOYEES})`],
  ['timeoff_allocations', `DELETE FROM timeoff_allocations WHERE employee_id IN (${QA_EMPLOYEES})`],
  ['timeoff_types', `DELETE FROM timeoff_types WHERE name LIKE 'Leave-%'`],
  ['attendances', `DELETE FROM attendances WHERE employee_id IN (${QA_EMPLOYEES})`],
  ['contracts', `DELETE FROM contracts WHERE employee_id IN (${QA_EMPLOYEES})`],
  // Clear the reporting line first: employees.manager_id is ON DELETE SET NULL,
  // but a QA employee may manage a real one, and that link should go too.
  [
    'employees.manager_id (unlink)',
    `UPDATE employees SET manager_id = NULL WHERE manager_id IN (${QA_EMPLOYEES})`,
  ],
  [
    'departments.manager_id (unlink)',
    `UPDATE departments SET manager_id = NULL WHERE manager_id IN (${QA_EMPLOYEES})`,
  ],
  ['employees', `DELETE FROM employees WHERE email LIKE ${QA_EMAIL}`],
  /**
   * A payrun whose last member was a QA employee is now empty, and an empty
   * payrun is not a thing the product can produce — it only exists because this
   * script removed the people out from under it. Left behind it renders as a
   * payrun of nobody. (It used to be worse: reading one threw and took the
   * whole payrun list with it, until `reconstitutePayrun` split reads from
   * creates.)
   */
  [
    'payruns emptied by this clean',
    `DELETE FROM payruns p
      WHERE NOT EXISTS (SELECT 1 FROM payrun_employees pe WHERE pe.payrun_id = p.id)`,
  ],
  ['working_schedules', `DELETE FROM working_schedules WHERE name LIKE 'Sched-%'`],
  ['job_positions', `DELETE FROM job_positions WHERE name LIKE 'Role-%'`],
  ['departments', `DELETE FROM departments WHERE name LIKE 'Dept-%'`],
]

/** Turn a DELETE/UPDATE into the COUNT that shows what it would touch. */
function toCount(sql: string): string {
  const from = sql.replace(/^DELETE FROM (\w+)/, 'SELECT COUNT(*)::int AS c FROM $1')
  if (from !== sql) return from.replace(/^(SELECT COUNT.*? FROM \w+) p/, '$1 p')
  return sql.replace(
    /^UPDATE (\w+) SET .*? WHERE/,
    'SELECT COUNT(*)::int AS c FROM $1 WHERE',
  )
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(apply ? 'APPLYING — rows will be deleted\n' : 'DRY RUN — nothing will be deleted\n')

  let total = 0
  for (const [label, sql] of STEPS) {
    const rows = await query<{ c: number }>(toCount(sql))
    const count = rows[0]?.c ?? 0
    total += count
    console.log(`${String(count).padStart(6)}  ${label}`)
  }
  console.log(`${String(total).padStart(6)}  TOTAL rows affected`)

  if (!apply) {
    console.log('\nRe-run with --apply to delete.')
    return
  }

  // One transaction: a partial clean would leave orphans behind.
  await transaction(async (client) => {
    for (const [label, sql] of STEPS) {
      const result = await client.query(sql)
      console.log(`deleted ${String(result.rowCount ?? 0).padStart(6)}  ${label}`)
    }
  })

  console.log('\nDone. Survivors:')
  for (const table of ['employees', 'departments', 'job_positions', 'timeoff_types', 'payruns']) {
    const rows = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "${table}"`)
    console.log(`${String(rows[0].c).padStart(6)}  ${table}`)
  }
}

main()
  .catch((reason) => {
    console.error('Failed:', reason instanceof Error ? reason.message : reason)
    process.exitCode = 1
  })
  .finally(closePool)
