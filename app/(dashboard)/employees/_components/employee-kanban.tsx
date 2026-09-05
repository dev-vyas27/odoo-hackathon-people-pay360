'use client'

/**
 * Kanban view of employees, grouped by department (spec A1).
 *
 * Kanban here means "cards grouped into columns", not a drag-and-drop board:
 * nothing about an employee is reordered by dragging, and inventing a drag
 * gesture that writes nothing would be a lie about what the screen does.
 */
import Link from 'next/link'
import { LuBuilding2, LuMail } from 'react-icons/lu'
import { EMPLOYEE_TYPE_LABELS, type EmployeeListItem } from '@/modules/people/schemas'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const UNASSIGNED = 'Unassigned'

export function EmployeeKanban({
  employees,
  departmentNames,
  isLoading,
}: {
  employees: EmployeeListItem[]
  /** id -> name, so a card can show a department without a second fetch. */
  departmentNames: Map<string, string>
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No employees match these filters</p>
      </div>
    )
  }

  // Group by department, preserving the order employees arrived in.
  const columns = new Map<string, EmployeeListItem[]>()
  for (const employee of employees) {
    const key = employee.departmentId
      ? (departmentNames.get(employee.departmentId) ?? UNASSIGNED)
      : UNASSIGNED
    const bucket = columns.get(key) ?? []
    bucket.push(employee)
    columns.set(key, bucket)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {[...columns.entries()].map(([department, members]) => (
        <section key={department} className="w-72 shrink-0">
          <header className="mb-3 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <LuBuilding2 className="size-3.5" aria-hidden />
              {department}
            </span>
            <span className="tabular text-xs text-muted-foreground">{members.length}</span>
          </header>

          <div className="space-y-2">
            {members.map((employee) => (
              <Link
                key={employee.id}
                href={`/employees/${employee.id}`}
                className={cn(
                  'block rounded-2xl border border-border bg-card p-3 transition-colors',
                  'hover:border-primary/40 hover:bg-accent',
                  !employee.isActive && 'opacity-60',
                )}
              >
                <p className="font-medium text-foreground">{employee.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LuMail className="size-3" aria-hidden />
                  <span className="truncate">{employee.email}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {EMPLOYEE_TYPE_LABELS[employee.employeeType]}
                  </Badge>
                  {!employee.isActive && (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Archived
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
