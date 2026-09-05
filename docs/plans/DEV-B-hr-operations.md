# Dev B — People, Employment & Attendance

> **You own the master data everyone else reads.** Payroll cannot compute without your
> contract resolution; the dashboard cannot count without your employee stats; Time Off
> cannot validate without your employee lookup.
>
> That makes your **port signatures** more urgent than your screens. Ship interfaces in
> hour one, stubs by hour three, real implementations after. Nobody can start until your
> contracts exist, and nobody is blocked once they do — even if the bodies are still fake.

**Modules you own:** `people` · `employment` · `attendance`

**Do not edit:** `modules/shared/**`, `lib/*`, `proxy.ts`, `components/ui/*`,
`components/resource/*` — those are Dev A's. Need a change there? Ask, don't patch.

---

## 0. Ground rules

| Rule | Why |
|---|---|
| Import other modules **only** from `@/modules/<name>` | ESLint enforces it. |
| `domain/` and `application/` never import `next/*`, `pg`, `react`, `@/lib/*` | Keeps your logic unit-testable with no database. |
| `await params`, `await searchParams`, `await cookies()` | Next 16 removed synchronous access. |
| Route handlers stay about 5 lines | Parse, call use case, `respond(result)`. |
| Use `Money` and `Period` from `@/modules/shared` | Never raw floats, never ad-hoc date maths. |
| `npm run verify` before every push | typecheck + lint + tests. |
| **Every form uses react-hook-form + zod** | Use `ResourceForm` from `@/components/resource/resource-form`. No `useState` forms, no manual validation. Define the zod schema once in the module's `interface/` folder and import it into **both** the form and the route handler so client and server cannot drift. |
| **Icons come from `react-icons` only** | `lucide-react` is removed. Use `react-icons/lu` for the Lucide glyph set (identical artwork) or any other `react-icons` pack. Adding `lucide-react` back will be rejected in review. |

**Status legend:** `P0` demo breaks without it · `P1` judged on it · `P2` cut first if behind.

---

## Phase 1 — H0 to H4

### H0–H1 — Contract hour (with Dev A and Dev C) `P0`

**Your single most important deliverable of the whole hackathon.** Write these signatures
and publish them from `modules/people/index.ts` and `modules/employment/index.ts` before
you write anything else:

```ts
// modules/people/application/ports/employee-lookup.port.ts
export interface EmployeeSummary {
  id: string
  name: string
  email: string
  departmentId: string | null
  departmentName: string | null
  jobPositionName: string | null
  employeeType: 'full_time' | 'part_time' | 'contract' | 'intern'
  managerId: string | null
  workingScheduleId: string | null
  bankAccount: string | null      // Dev C needs this for the missing-bank-details warning
  isActive: boolean
}

export interface EmployeeLookupPort {
  findById(employeeId: string): Promise<EmployeeSummary | null>
  findManyByIds(ids: string[]): Promise<EmployeeSummary[]>
  findEligible(filter: {
    departmentId?: string
    employeeType?: string
    activeOn: Date
  }): Promise<EmployeeSummary[]>       // drives the Payrun wizard step 2
}
```

```ts
// modules/employment/application/ports/contract-query.port.ts
export interface ContractSnapshot {
  id: string
  employeeId: string
  wage: number                    // major units; convert with Money.of() at the boundary
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  end: Date | null                // null = open-ended
}

export interface ContractQueryPort {
  // THE method payroll is built on. See the resolution rules below.
  findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>
  findByEmployee(employeeId: string): Promise<ContractSnapshot[]>
}

// modules/employment/application/ports/schedule-query.port.ts
export interface ScheduleSnapshot {
  id: string
  name: string
  weeklyHours: number
  days: Array<{ day: 0|1|2|3|4|5|6; start: string; end: string; breakMinutes: number }>
}

export interface ScheduleQueryPort {
  findById(id: string): Promise<ScheduleSnapshot | null>
  expectedHours(scheduleId: string, period: Period): Promise<number>   // payroll prorating
}
```

```ts
// modules/attendance/application/ports/attendance-stats.port.ts
export interface AttendanceStatsPort {
  workedHours(employeeId: string, period: Period): Promise<number>
  workedDays(employeeId: string, period: Period): Promise<number>      // payslip "Worked Days"
  summary(period: Period, departmentId?: string): Promise<{
    present: number; late: number; absent: number
    overtimeHours: number; missingCheckouts: number; manualEdits: number
  }>
}
```

**By H1, commit these interfaces with `throw new Error('not implemented')` stubs.** Dev A
and Dev C build against them immediately. Do not make them wait for real code.

### H1–H4 — People module `P0`

```
modules/people/
  domain/
    employee.ts          AGGREGATE ROOT
    department.ts
    job-position.ts
    employee-type.ts     value object / enum
  application/
    ports/employee-repository.port.ts
    create-employee.use-case.ts
    update-employee.use-case.ts
    list-employees.use-case.ts
    archive-employee.use-case.ts     publishes EmployeeArchived
    get-employee-detail.use-case.ts  includes the smart-button counts
  infrastructure/
    employee.table.ts  department.table.ts  job-position.table.ts
    postgres-employee.repository.ts  extends BaseSqlRepository
    employee-lookup.adapter.ts       implements EmployeeLookupPort
  interface/employee.controller.ts
  index.ts                           exports the ports + adapter factory
```

Routes: `app/api/employees/route.ts` (GET list, POST create),
`app/api/employees/[id]/route.ts` (GET, PATCH, DELETE),
plus `departments` and `job-positions`.

> **Row-level access:** an `employee` role may read only their own record. Use
> `authorizeOwned(actor, 'employee', 'read', record.employeeId)` inside the use case.
> Do not try to solve this in `proxy.ts` — it has no idea which row is being fetched.

---

## Phase 2 — H4 to H10 · The hard parts

### Employment: Contract `P0` `P1`

```
modules/employment/
  domain/
    contract.ts                  AGGREGATE ROOT
    contract-resolution.ts       PURE — the rule payroll depends on
    working-schedule.ts          AGGREGATE ROOT
    weekly-hours.service.ts      PURE — derives weekly hours from the day pattern
```

**Contract resolution rules** (spec A2 — the highest-value logic you own):

1. A contract applies to a period when its validity `Period` overlaps the payroll `Period`.
2. When several overlap, prefer the one covering the period **end**, then the latest `start`.
3. **Concurrent active contracts must be prevented at write time**, not patched at read
   time. Reject on create/update when the new range overlaps an existing one for the same
   employee. This is the spec's explicit "avoiding concurrent active contracts".
4. Never mutate a historical contract to make payroll work. History is the point.

Test this before you build the UI. It is pure, it has no dependencies, and it is exactly
the logic a judge will interrogate.

**Working schedules** (spec A3): the form defines Day / Start / End / Break, and
`weeklyHours` is **computed**, never typed in by the user. Put that computation in
`weekly-hours.service.ts` and unit-test it — including a break that spans lunch and a
schedule with an unusual day pattern.

Screens: `contracts/` list highlighting the active contract, `contracts/[id]` form,
`schedules/` list plus form.

### Attendance `P0`

```
modules/attendance/
  domain/
    attendance.ts            AGGREGATE ROOT
    worked-hours.service.ts  PURE: check-in/out + break -> worked hours
    exception.ts             late | absent | overtime | missing_checkout | manual
  application/
    check-in.use-case.ts  check-out.use-case.ts
    correct-attendance.use-case.ts    authorized users only; flags the record `manual`
    list-attendance.use-case.ts
```

Derive the exception status by comparing actual worked hours against the employee's
assigned schedule — that is where Attendance and Employment meet, and it is a genuinely
good thing to show a judge.

Screens: global `attendance/` list showing Check In, Check Out, Worked Hours, Status, plus
the same list filtered by employee from the Employee form.

---

## Phase 3 — H10 to H14 · Integration `P0`

Replace every stub with real implementations, in this order — it is dependency order, and
getting it wrong wastes an hour:

1. `EmployeeLookupPort` → unblocks Dev A's Time Off and Dev C's Payrun wizard
2. `ContractQueryPort` → unblocks Dev C's payslip computation (**the critical path**)
3. `ScheduleQueryPort` → unblocks proration
4. `AttendanceStatsPort` → unblocks worked days on payslips and Dev A's dashboard

Tell Dev C the moment `findApplicableContract` is real. Their engine is dead until then.

---

## Phase 4 — H14 to H18 · The Employee hub `P1`

The Employee form is the spec's "central hub" (sections A1, B2) and the first screen in
the demo. Make it good.

- **Kanban** (`P1`) and **List** (`P0`) views, both opening the same form
- Form shows identity, department, manager, job position, schedule, employee type, active status
- **Smart buttons** (`P0`) with live counts opening filtered views: Contracts, Attendance,
  Time Off, Allocations. `SmartButton` is already built — you supply counts and hrefs.
- Counts come from one `get-employee-detail` use case, not four client-side round trips.

Then: `stats.port` implementations for Dev A's dashboard (headcount by department,
headcount by employee type).

---

## Phase 5 — H18 to H24

- `H18` Freeze. Bug fixes only.
- `H19–H21` Rehearse **your** demo scenario end to end: create employee, assign schedule,
  add contract, record attendance, open the Employee form and walk the smart buttons.
- `H21–H23` Bug bash with Dev A.
- Help verify seed data looks right — you know best what realistic HR data should be.

---

## Definition of done

- [ ] `npm run verify` green
- [ ] Contract resolution unit-tested, including overlapping and expired contracts
- [ ] Creating an overlapping contract is **rejected** with a clear message
- [ ] Weekly hours compute from the day pattern; the field is not user-editable
- [ ] Employee form smart buttons show correct counts and open correctly filtered lists
- [ ] An `employee` role user can see their own record and **cannot** see anyone else's
- [ ] All four ports implemented and consumed by their real owners
