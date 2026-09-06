/**
 * Resolves the department and job-position NAMES for a set of employees.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * An employee record carries `departmentId`, not the department's name. Every
 * screen that displayed one therefore fetched the whole department list and
 * looked the id up on the client — the employee table, the detail page's
 * identity strip, and the form's select all did their own version of it.
 *
 * That works right up until the viewer is a plain `employee`. They hold
 * `employee:read` and nothing else, so `GET /api/departments` answers 403, the
 * options array comes back empty, the lookup misses, and their own department
 * silently disappears — while an admin looking at the same record sees it fine.
 * That was the reported bug, and it had three faces: a dash in the table, a
 * missing segment in the identity line, and a select showing its placeholder.
 *
 * The fix is not to widen what an employee may read. It is that a name you are
 * already allowed to see should travel WITH the record, resolved here, on the
 * server, inside a read the caller has already been authorised for. Nobody
 * should need permission over a whole reference table to render one row of
 * their own.
 *
 * Editing is the separate case and still needs the real list: changing your
 * department means choosing from all of them, and only roles that may update an
 * employee can do that. Display and choice are different questions.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Two queries per request, each `WHERE id = ANY(...)` over the ids actually
 * present — not one per row. It also REMOVES two list fetches from every
 * employee screen, so the detail page is now cheaper than it was.
 */
import { query } from '@/lib/db'

export interface Placement {
  departmentName: string | null
  jobPositionName: string | null
  managerName: string | null
  workingScheduleName: string | null
}

interface NameRow {
  id: string
  name: string
}

/** Distinct, non-null ids. Skips the query entirely when there are none. */
function idsOf(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))]
}

/**
 * All four, because the FORM needs them too.
 *
 * The identity strip shows department and position, but the edit form has four
 * selects, and every one of them fell back to its placeholder for the same
 * reason — a plain employee holds none of `department:read`,
 * `job_position:read` or `working_schedule:read`, so all four option lists came
 * back empty and their own manager and schedule vanished along with the rest.
 */
async function namesFor(
  table: 'departments' | 'job_positions' | 'employees' | 'working_schedules',
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>()
  /**
   * The table name is a literal from this module's own union type, never a
   * caller's string, and the ids are bound. Nothing here is interpolated from
   * input.
   */
  const rows = await query<NameRow>(
    `SELECT id, name FROM "${table}" WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((row) => [row.id, row.name]))
}

export interface HasPlacement {
  departmentId?: string | null
  jobPositionId?: string | null
  managerId?: string | null
  workingScheduleId?: string | null
}

/**
 * Look up both name sets for a batch of employees.
 *
 * Returns a function rather than the maps, so the caller reads as
 * `...placement(employee)` at the point it builds each view row.
 */
export async function resolvePlacement(
  employees: readonly HasPlacement[],
): Promise<(employee: HasPlacement) => Placement> {
  const [departments, positions, managers, schedules] = await Promise.all([
    namesFor('departments', idsOf(employees.map((e) => e.departmentId))),
    namesFor('job_positions', idsOf(employees.map((e) => e.jobPositionId))),
    namesFor('employees', idsOf(employees.map((e) => e.managerId))),
    namesFor('working_schedules', idsOf(employees.map((e) => e.workingScheduleId))),
  ])

  return (employee) => ({
    departmentName: employee.departmentId
      ? (departments.get(employee.departmentId) ?? null)
      : null,
    jobPositionName: employee.jobPositionId
      ? (positions.get(employee.jobPositionId) ?? null)
      : null,
    managerName: employee.managerId ? (managers.get(employee.managerId) ?? null) : null,
    workingScheduleName: employee.workingScheduleId
      ? (schedules.get(employee.workingScheduleId) ?? null)
      : null,
  })
}
