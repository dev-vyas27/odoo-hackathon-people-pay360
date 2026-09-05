# Dev C — Payroll Configuration & Payroll Processing

> **You own the differentiator.** Employee CRUD is table stakes; every team will have it.
> The salary rule engine, sequenced computation, period-correct contract selection and
> pre-finalisation warnings are what the spec actually grades (sections 5, 6, 7) and what
> a judge will poke at.
>
> Your deepest work has **no UI dependency at all**. Build the engine against fake data in
> hours 1 to 4 while the others are still wiring screens, and you will be the only person
> who is never blocked.

**Modules you own:** `payroll-config` · `payroll-processing`

**Do not edit:** `modules/shared/**`, `lib/*`, `proxy.ts`, `components/ui/*`,
`components/resource/*` — those are Dev A's. Need something there? Ask.

---

## 0. Ground rules

| Rule | Why |
|---|---|
| Import other modules **only** from `@/modules/<name>` | ESLint enforces it. |
| `domain/` and `application/` never import `next/*`, `pg`, `react`, `@/lib/*` | Your engine must run in a unit test with no database. This is non-negotiable for you specifically. |
| `await params`, `await searchParams`, `await cookies()` | Next 16 removed synchronous access. |
| **Money is never a float** | `Money` stores integer minor units. A one-paise drift across 500 payslips is unfindable at 3am. |
| `npm run verify` before every push | typecheck + lint + tests. |
| **Every form uses react-hook-form + zod** | Use `ResourceForm` from `@/components/resource/resource-form`. No `useState` forms, no manual validation. Define the zod schema once in the module's `interface/` folder and import it into **both** the form and the route handler so client and server cannot drift. |
| **Icons come from `react-icons` only** | `lucide-react` is removed. Use `react-icons/lu` for the Lucide glyph set (identical artwork) or any other `react-icons` pack. Adding `lucide-react` back will be rejected in review. |

**Status legend:** `P0` demo breaks without it · `P1` judged on it · `P2` cut first if behind.

---

## Phase 1 — H0 to H4 · Build the engine before the UI exists

### H0–H1 — Contract hour (with Dev A and Dev B) `P0`

Agree what you **consume** from Dev B (`ContractQueryPort`, `EmployeeLookupPort`,
`ScheduleQueryPort`, `AttendanceStatsPort`) and publish what you **provide**:

```ts
// modules/payroll-processing/application/ports/payslip-query.port.ts
// Consumed by Dev A for PDF generation and bulk email.
export interface PayslipLineView {
  code: string; name: string; category: SalaryCategory
  sequence: number; amount: number
}
export interface PayslipView {
  id: string; employeeId: string; employeeName: string
  payrunId: string; payrunName: string
  periodStart: Date; periodEnd: Date
  structureName: string; workedDays: number
  lines: PayslipLineView[]
  basic: number; gross: number; deductions: number; net: number
  status: PayslipStatus
}
export interface PayslipQueryPort {
  findById(payslipId: string): Promise<PayslipView | null>
  findByPayrun(payrunId: string): Promise<PayslipView[]>
}

// modules/payroll-processing/application/ports/payroll-stats.port.ts
// Consumed by Dev A for the dashboard.
export interface PayrollStatsPort {
  totals(period: Period, departmentId?: string): Promise<{
    totalNet: number; payslipCount: number; averageSalary: number
  }>
  costByDepartment(period: Period): Promise<Array<{ departmentId: string; total: number }>>
  monthlyTrend(months: number): Promise<Array<{ month: string; total: number }>>
}
```

Commit these with `throw new Error('not implemented')` stubs by H1 so Dev A is never blocked.

### H1–H4 — The salary rule engine `P0` `P1` — pure, tested, no database

This is the heart of the project. Write it with **TDD**, because it is pure functions and
the tests cost you minutes while catching the bugs that would otherwise surface on stage.

```
modules/payroll-config/domain/
  salary-category.ts       basic | allowance | gross | deduction | net
  salary-rule.ts           name, code, category, sequence, computation
  salary-structure.ts      AGGREGATE ROOT: an ordered collection of rules
  computation/
    computation.strategy.ts    interface { compute(ctx): Money }
    fixed-amount.strategy.ts
    percentage.strategy.ts     percentage OF a named earlier rule code
    formula.strategy.ts        safe evaluator — see the warning below
    strategy.registry.ts       code -> strategy (Strategy + Registry = OCP)
  rule-engine.ts               executes rules in sequence, accumulates results
```

**Strategy + Registry is the whole point.** Adding a new computation type means adding one
class and one registry line. The engine never changes. Say this sentence during the demo —
it is exactly the "industry-standard architecture" the spec asks for in section 6.

**Sequencing is the second point.** Rules run in `sequence` order and each can reference
results of earlier ones by `code`:

```
seq 10  BASIC     fixed          contract wage, prorated by worked days
seq 20  HRA       percentage     40% of BASIC
seq 30  TA        fixed          1600
seq 40  GROSS     formula        BASIC + HRA + TA
seq 50  PF        percentage     12% of BASIC        (deduction)
seq 60  TAX       formula        slab on GROSS       (deduction)
seq 70  NET       formula        GROSS - PF - TAX
```

The engine carries a context of results-so-far; referencing a code that has not run yet is
an **error**, not a zero. Silently treating it as zero produces a wrong payslip that looks
right, which is the worst possible failure.

> **On `formula`:** do **not** use `eval` or `new Function` on user input. Write a tiny
> evaluator over a whitelisted token set (rule codes, numbers, `+ - * / ( )`, and a
> `min`/`max` helper). About 60 lines, and it turns a glaring security hole into a
> talking point. If you fall badly behind, restrict formulas to a fixed set of named
> operations rather than shipping `eval`.

**Tests to write first** (`P0`): a full structure computing end to end; percentage-of-earlier-rule;
sequence dependency violation raising; deductions reducing net; proration by worked days;
rounding correctness at the paise level.

---

## Phase 2 — H4 to H10 · Payroll config UI + Payrun aggregate

### Salary Structures and Rules screens `P0`

Spec A5 and A6. Use Dev A's `ResourceTable` and `resource-form`.

- Structure list: name, number of rules, employees, active status
- Structure form: manages included rules **and their execution sequence** (drag or a
  numeric sequence field — either is fine, do not gold-plate)
- Rule list and form: Name, Code, Category, Sequence, computation type and its parameters
- Categories drive the payslip breakdown, so keep them exactly: Basic, Allowance, Gross,
  Deduction, Net

> The spec is explicit that these screens must be **functional, not mockups** — the rules
> configured here must actually drive computation. That linkage is the demo moment: edit a
> rule, recompute, watch the payslip change.

### Payrun aggregate `P0`

```
modules/payroll-processing/domain/
  payrun.ts               AGGREGATE ROOT
  payrun-state.ts         State pattern: draft -> computed -> validated -> paid
  payslip.ts              AGGREGATE ROOT
  payslip-factory.ts      (employee, contract, structure, period) -> Payslip
  eligibility.spec.ts     Specification: who may be included in this payrun
  warnings/
    warning.port.ts       interface IPayrollWarningCheck { check(ctx): Warning[] }
    missing-bank-details.check.ts
    duplicate-payslip.check.ts
    missing-contract.check.ts
    contract-expiring.check.ts
    warning.registry.ts   an array — adding a check never edits the validator
```

State transitions are enforced in the aggregate. Calling `markPaid()` on a `draft` payrun
**throws**. Do not scatter status checks through controllers.

---

## Phase 3 — H10 to H14 · Wiring and the wizard `P0`

Swap your fake contract/employee data for Dev B's real ports. Expect this to surface
mismatches — that is exactly why the contract hour existed, and it should cost minutes,
not hours.

### Payrun creation wizard (spec B5) — a distinctive UI moment

```
app/(dashboard)/payroll/payruns/new/page.tsx    uses Dev A's wizard-shell
```

1. **Step 1** — scope: Salary Structure and Period. **Clicking Continue must NOT create a
   record.** The spec calls this out specifically; a judge may well check.
2. **Step 2** — eligible employees listed via `EmployeeLookupPort.findEligible()` for
   explicit selection.
3. **Create Payrun** — only now is the batch persisted, containing only the selected
   employees, and the processing view opens.

Hold wizard state in React until the final submit. One `POST /api/payruns` at the end.

---

## Phase 4 — H14 to H18 · Processing, payslips, warnings

### Payrun processing screen `P0` (spec B6)

Actions: **Compute · Validate · Mark Paid · Send Payslips** (the last delegates to Dev A's
delivery module through an event or a direct call to its published surface).

Show run name, structure, period, status, and the payslip summary list. Surface warnings
**before** finalisation — missing bank details, duplicate payslips, contract attention
items. Finalised and paid runs are preserved as history and must become read-only.

### Payslip and computation screen `P0` `P1` (spec B7)

Displays Employee, Structure, Pay Run, Period, Status, Worked Days, and a **Salary
Computation** section showing the individual rule breakdown: Basic, Allowances, Gross,
Deductions, Net.

Show the line items **in sequence order with their codes visible**. That single design
choice makes the whole engine legible to a judge in about four seconds — they can read the
computation happening.

Computation pulls the applicable contract via `ContractQueryPort.findApplicableContract()`
and the structure assigned to the payrun. Never read "the employee's current contract" —
read the contract that applies to the **payroll period**. This is the single most
spec-emphasised rule in the entire document (sections 1, 2, A2, 5) and it is your module
that has to honour it.

---

## Phase 5 — H18 to H24

- `H18` Freeze. Bug fixes only.
- `H19–H21` Rehearse **your** scenario: create payrun via wizard, compute, review warnings,
  inspect a payslip breakdown, validate, mark paid, print PDF. Time it.
- `H21–H23` Bug bash.
- Prepare one sentence each on: why Strategy for rules, why sequencing matters, why the
  contract is period-resolved. You will be asked.

---

## Definition of done

- [ ] `npm run verify` green
- [ ] Rule engine unit-tested end to end, including sequence dependencies and rounding
- [ ] No `eval` anywhere in the formula evaluator
- [ ] Wizard step 1 provably creates nothing until Create Payrun is pressed
- [ ] Payslip uses the **period-applicable** contract, demonstrated with an employee who has two
- [ ] All four warning checks fire, and are visible before validation
- [ ] Illegal state transitions throw rather than silently succeeding
- [ ] `PayslipQueryPort` and `PayrollStatsPort` implemented for Dev A
