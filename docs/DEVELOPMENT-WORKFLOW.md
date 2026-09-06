# PeoplePay360 — Development Workflow, API Contracts & Design Patterns

> **Purpose of this document.** This is the team's briefing note for evaluation. It explains
> *what* was built, *how* it was built, *how the modules talk to each other*, and *which design
> pattern sits where and why*. Everything here is read off the code on the `development` branch,
> not from notes. Read this once before judging and no question about the system should be a
> surprise.
>
> **Companion document:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the same system as diagrams.

---

## Table of contents

1. [The development workflow](#part-1--the-development-workflow)
2. [The API contract: what provides it and how](#part-2--the-api-contract-what-provides-it-and-how)
3. [Module by module](#part-3--module-by-module)
4. [Design pattern index](#part-4--design-pattern-index)
5. [Answers to the hard questions, and known gaps](#part-5--what-to-say-when-asked-the-hard-ones)

---

# PART 1 — THE DEVELOPMENT WORKFLOW

## 1.1 The core problem we had to solve first

Three developers, 24 hours, one codebase. The naive split is "you do frontend, you do backend,
you do database" — that fails immediately because everyone ends up editing the same files and
blocking on each other. The second-naive split is by feature, which fails differently: payroll
needs employees, the dashboard needs payroll, and whoever writes their module second sits idle
waiting for the first.

So the split was made **by bounded context**, and the coupling between contexts was made
**inversion-shaped** so nobody waits.

| Developer | Modules owned |
|---|---|
| **Dev A** | platform kernel (`modules/shared`), database + migrations, `identity`, `timeoff`, `analytics`, `delivery` |
| **Dev B** | `people`, `employment`, `attendance` |
| **Dev C** | `payroll-config`, `payroll-processing` |

Branches: `feature/database-and-schema-platform-architecture` (A), `feature/hr-operations` (B),
`feature/payroll` (C), integrated into `development`.

## 1.2 "Hour Zero" — the contract hour

Before anyone wrote a feature, we spent the first block writing **only type declarations and
empty seams**. Nothing that runs. This produced four files, and they are the reason the project
integrated instead of exploding:

1. **`modules/shared/contracts/dto.ts`** — every data shape that crosses a module boundary.
   Nothing else. It is split into owner-labelled sections (`// People — owner: Dev B`), so three
   people edit it in parallel and git merges the regions independently instead of fighting over
   one blob.
2. **`modules/shared/contracts/port-keys.ts`** — the string keys under which modules publish
   capabilities to each other. It carries a comment saying the file is **append-only: add your
   key, never renumber or reorder**.
3. **`modules/shared/contracts/permissions.ts`** — the whole role/resource/action matrix, as data.
4. **`modules/shared/contracts/schema.ts`** — shared zod primitives (`uuid`, `money`, `dateField`,
   `timeField`, `pageQuerySchema`).

Once those existed, **Dev C could write and unit-test the entire payroll engine before a single
employee record existed**, because they were coding against `EmployeeLookupPort` and
`ContractQueryPort` — interfaces, not Dev B's code.

## 1.3 How modules talk without importing each other

This is the single most important thing to be able to explain.

`analytics` needs headcount from `people`. If it did `import { listEmployees } from
'@/modules/people'`, then Dev A cannot typecheck until Dev B has written that module, and every
integration becomes a merge conflict.

Instead:

```
Provider  (people)    →  providePort(PORT_KEYS.employeeStats, () => new EmployeeStatsAdapter())
Consumer  (analytics) →  portOr(PORT_KEYS.employeeStats, NULL_EMPLOYEE_STATS)
```

`modules/shared/container.ts` holds a `Map<PortKey, factory>`. Three properties matter:

- **The factory is lazy.** Registering a port does not open a database connection at import time.
- **`getPort` returns `null` when nobody has provided it yet**, and `portOr` supplies a null-object
  fallback. This is why the dashboard rendered zeros on hour 6 and real numbers on hour 18, with
  **zero lines changed in the consumer**.
- **`providePort` is first-wins** (`if (!c.ports.has(key))`). Combined with the ordering in
  `lib/bootstrap.ts`, where the interim scaffolding adapters are registered *last*, a real
  implementation always beats the placeholder — and swapping a stub for the real thing is a
  bootstrap ordering fact, not a code change.

One naming detail worth having an answer for: the consumer function is called **`getPort`, not
`usePort`**. A `use` prefix makes the React hooks lint rule treat every call site as a hook and
reject it inside a plain function — which is where all of these are called from.

The container is cached on `globalThis` so Next's dev hot-reload does not rebuild the graph and
re-subscribe every event handler on each edit.

## 1.4 The composition root

`lib/bootstrap.ts` is the **only** file in the codebase that knows all ten modules exist. It is
called from `instrumentation.ts`, which Next runs once at server startup, and it is idempotent
(`if (done) return`) because Next re-evaluates modules on hot reload and registering twice would
fire every event handler N times.

```ts
registerTimeOff()          // Dev A
registerPeople()           // Dev B — EmployeeLookupPort
registerEmployment()       // Dev B — ContractQueryPort, ScheduleQueryPort
registerAttendance()       // Dev B — AttendanceStatsPort
registerPayrollPorts()     // Dev C — PayslipQueryPort, PayrollStatsPort
registerInterimAdapters()  // must stay last
registerInterimStats()     // must stay last
```

**Nothing else in the codebase calls `new PostgresSomethingRepository()`.** That is what makes
Dependency Inversion real here rather than a README claim: use cases name a port, this file
decides what satisfies it, and a test decides differently.

## 1.5 Order of construction, and why

Within each module, everyone built in the same direction — **domain first, HTTP last**:

1. **`domain/`** — pure objects and rules. No imports from Next, no database, no zod. Unit-tested
   with literals in milliseconds.
2. **`application/`** — use cases that orchestrate the domain, receiving collaborators through the
   constructor. Tested against in-memory fakes.
3. **`infrastructure/`** — the Postgres repositories and the port adapters. First point at which
   SQL appears.
4. **`interface/`** — zod schemas and controllers, the HTTP-facing edge.

The payoff: by the time we touched infrastructure, the business rules were already proven correct.
33 test files, 300 tests, and the bulk of them never touch a database — which is why the suite runs
in seconds and we could actually afford to run it on every change.

## 1.6 How the boundaries are *enforced*, not just agreed

Conventions decay under time pressure. So the rules are machine-checked in `eslint.config.mjs`
via `no-restricted-imports`:

1. A module may not import another module's internals — only `@/modules/shared`.
2. `domain/` and `application/` may not import Next.js, `pg`, or any framework.
3. `modules/shared` may not import from any feature module (it would become a dependency magnet).

**Worth knowing if challenged:** ESLint flat config **overrides** rather than merges. A later
config block that sets `no-restricted-imports` for `domain/**` *replaces* the earlier one entirely.
We hit this — the domain/application block silently disabled the cross-module checks it was meant
to strengthen. It was caught by a negative probe unexpectedly passing, and the fix was to repeat
the cross-module patterns inside that block. There are now explicit tests for all four guarantees.

## 1.7 The database, and the one thing to be honest about

PostgreSQL 18 on Render, accessed with the `pg` driver and **hand-written SQL**. No ORM,
deliberately: an ORM's generated SQL is the thing you cannot explain when asked, and
`EXCLUDE USING gist` for contract-overlap prevention is not expressible in most of them anyway.

Nine forward-only migrations in `migrations/`, ordered by dependency:
`0001_init` → `0002_organisation` → `0003_payroll_config` → `0004_people` → `0005_identity` →
`0006_employment` → `0007_attendance` → `0008_timeoff` → `0009_payroll_processing` →
`0010_identity_on_employees`. Seventeen application tables plus a `schema_migrations` bookkeeping
table — 0010 dropped `users`, folding logins into `employees`.

**A mid-project event you should be ready for:** the stack started on MongoDB and moved to
PostgreSQL partway through. The decision taken was that Dev A owns the schema and the other two
conform to it, rather than each dev migrating their own slice. That resolved four real
domain/schema mismatches at the persistence boundary — a manual-correction flag became
`is_manual`, contract reads became JOINs, `departments.code` became derived, and
`parentDepartmentId` was dropped. Only the `infrastructure/` folders changed. Domain and
application layers were untouched, which is precisely the payoff the layering was built for, and
it is the strongest evidence available that the architecture is not decorative.

---

# PART 2 — THE API CONTRACT: WHAT PROVIDES IT AND HOW

## 2.1 The full path of one request

Take `POST /api/employees`. Seven layers, each with exactly one job:

```
Browser
  │  react-hook-form + zodResolver validates locally
  ▼
proxy.ts                    authentication + section-level authorization
  ▼
app/api/employees/route.ts  ~5 lines. parse → controller → respond
  ▼
employee.controller.ts      zod parse → resolve repository → build use case
  ▼
CreateEmployeeUseCase       authorize → orchestrate → return Result
  ▼
Employee (domain)           invariants
  ▼
PostgresEmployeeRepository  parameterised SQL, returns a domain object
  ▼
PostgreSQL
```

The route handler in full — this is every route handler in the project:

```ts
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor()
    return respond(await createEmployee(actor, await request.json()), 201)
  })
}
```

43 route handlers, all this shape. **There is no business logic anywhere in `app/api/`.** If an
evaluator opens a random route file, that is what they will find, and that is deliberate.

## 2.2 Authorization is two-layer, on purpose

**Layer 1 — `proxy.ts`.** Next 16 renamed `middleware.ts` → `proxy.ts`; it runs on the Node
runtime, which is *not* configurable — convenient, because it means we verify the JWT properly
rather than doing a cookie-presence hand-wave at the edge. It answers coarse questions only: is
there a valid session, and is this *area* of the app open to this role. Unauthenticated `/api/*`
gets JSON 401; a human gets redirected to `/login?next=…`.

**Layer 2 — inside every use case**, via `authorize(actor, resource, action)` or
`authorizeOwned(...)`.

Why both? Because the middleware knows the URL but **not the row**. "An employee may read
attendance" is a middleware-answerable question. "An employee may read *their own* attendance" is
not — you need the record. That is `authorizeOwned`, which composes the role check with an
ownership check driven by `scopeToSelf(role)`.

`modules/shared/contracts/permissions.ts` encodes the matrix as data, with higher roles spreading
the role beneath them (`HR_PAYROLL_USER = [...HR_MANAGER, ...]`), mirroring the spec's own wording
"All HR Manager permissions plus…". One place to audit, one place to change, **and the UI imports
the same table** to decide which buttons to render. There is no possible drift between what a
button offers and what the API allows.

## 2.3 Validation is defined once and used twice

The project rule is: every form uses react-hook-form with a zod schema, **and the same schema
object validates the request in the route handler.**

The schema lives in the module's `interface/` folder (e.g.
`modules/people/interface/employee.schema.ts`) and is imported by both sides. This kills the
classic bug where the UI accepts something the API then rejects with an unhelpful 500.

Because `pg` must never reach the browser, each module has **two barrels**:

- `@/modules/<x>/schemas` — client-safe. Zod schemas, list-item types, label maps, pure helpers.
- `@/modules/<x>` — server. Controllers, repositories, everything else.

We got this wrong twice and both times the symptom was a build error `Can't resolve 'dns'` — once
from exporting `BaseSqlRepository` through `modules/shared/index.ts`, once from a
`_components/options.ts` importing `@/modules/people`. `modules/shared/server.ts` now exists
specifically to keep the SQL base class off the client path.

**A detail worth defending:** `modules/shared/server.ts` deliberately does *not* use
`import 'server-only'`. That package throws when there is no bundler, which broke the seed and
migration scripts that run in plain Node.

## 2.4 One error contract for the whole API

`modules/shared/domain/result.ts` gives every use case the signature `Promise<Result<T>>`.
Expected failures are **returned**, not thrown. Only genuine bugs throw.

`lib/http.ts` is the only file in the codebase that knows about both `Result` and `Response`:

| `DomainError.kind` | HTTP |
|---|---|
| `validation` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `conflict` | 409 |
| `rule_violation` | 422 |

Every response is `{ data: … }` or `{ error: { code, message, details } }`. **The frontend has
exactly one error shape to handle, across 43 endpoints.**

`handle()` also catches *thrown* `DomainError`s and runs them through the same table. Aggregates
throw to enforce invariants — `payrun.markPaid()` on a draft throws — and without this that would
surface as a 500 instead of a 422.

`parseWith()` bridges zod's throw-based world into the Result world, mapping ZodIssues into
`details.issues[]` so the client gets field-level messages.

## 2.5 List endpoints share one query contract

`parsePageQuery(url)` in `lib/http.ts` converts any request URL into the `PageQuery` every list
use case takes. Five reserved keys (`page`, `limit`, `sort`, `order`, `search`) mean paging;
**everything else becomes a filter**. So `?status=approved&departmentId=x` lands in `filters` and
`BaseSqlRepository.buildWhere` turns it into parameterised SQL with no per-module plumbing.

Empty values are dropped rather than filtered on — a cleared `<select>` submits `''`, and matching
the empty string would hide every row.

Every list response is a `ListEnvelope<T>`: `{ items, total, page, limit, pages }`.

---

# PART 3 — MODULE BY MODULE

## `modules/shared` — the kernel (Dev A)

Not a feature. The vocabulary every other module speaks. Contains `Actor`, `Result`, `DomainError`,
`Money`, `Period`, the DTOs, the permission matrix, `BaseSqlRepository`, the event bus, and the
container. Enforced rule: **it imports from nobody.**

**`Money` — Value Object.** Integer minor units (paise), immutable, private constructor, static
factories `of` / `fromMinor` / `zero`. Why: payroll must never use floats. `0.1 + 0.2 !== 0.3`, and
a one-paise drift across 500 payslips is a reconciliation bug nobody finds at 3am. All arithmetic
is integer arithmetic; rounding happens **once**, explicitly, in `times()`. `assertSameCurrency`
makes mixing currencies a thrown error rather than a silent wrong number.

**`Period` — Value Object.** Inclusive `[start, end]` at day granularity, normalised to UTC
midnight. Used by payroll periods, contract validity, leave requests and allocation validity.
Overlap logic lives here **once**, which is why "which contract applies to this payrun" and "does
this leave collide" cannot drift apart. `days` is inclusive — a single-day period is 1, not 0,
which is the off-by-one that would otherwise silently underpay someone.

**`BaseSqlRepository` — Template Method.** Subclasses declare `table`, `columns`, `searchable`,
`defaultSort` and a `toDomain` mapper; they inherit paging, search, filtering, sorting and CRUD.
Anything genuinely aggregate-specific ("find the contract covering this period") is written as real
SQL on the subclass rather than by making the base class cleverer.

Two things to be able to say about it under questioning:

- **Injection.** Values are always `$1, $2` placeholders. But a *column name cannot be a bind
  parameter*, and `?sort=name; DROP TABLE users --` arrives from the query string headed for an
  ORDER BY. So **the declared `columns` array is an allowlist**: every identifier the class emits
  is checked against it and double-quoted. An unrecognised sort column falls back to the default
  rather than throwing — a bad URL should not be a 500.
- **Why two queries instead of `COUNT(*) OVER ()`.** The window function saves a round trip but
  makes the planner materialise the full result set to count it. The two statements run
  concurrently via `Promise.all`, so the extra round trip costs nothing in wall-clock terms.

`toColumnName()` converts `employeeId` → `employee_id`, so the API speaks camelCase and the schema
speaks snake_case without either compromising.

**`InMemoryEventBus` — Observer.** Handlers are awaited sequentially, and a throwing handler is
logged but **never allowed to fail the publisher**. Approving a leave request must not roll back
because a downstream listener has a bug.

## `modules/identity` (Dev A)

Accounts, roles, login, bcrypt hashing.

**There is no `users` table.** Migration 0010 folded it into `employees`: the employee row carries
`role` and a nullable `password_hash`, and that row IS the account. 0005 had kept them apart for
good abstract reasons — not every employee needs a login, an admin might have no HR record — but
neither case occurs in this product. An administrator creates an employee, and that employee is the
account; there is no other way for a person to enter the system. Two tables in a one-to-one
relationship that is always populated bought a join and a class of bug (an orphan login, a person
with two identities) in exchange for flexibility nobody used.

Two consequences worth being able to state:

- **`password_hash` is nullable, and the nullability carries the meaning.** An employee with no hash
  is an HR record that cannot sign in — that is how "on the payroll, no account" survives the merge.
  `Account.assertCanSignIn()` rejects a null hash and a deactivated employee with the *same* message
  as a wrong password, so the login form never confirms whether an address exists.
- **The two modules project different columns of the same table.** `people` owns the HR fields and
  `EMPLOYEE_COLUMNS` does not list `role` or `password_hash`; `identity` owns the credentials. Since
  `BaseSqlRepository` treats its column list as an allowlist for reads, filters *and* sorts, the
  people module cannot leak or even sort by a password hash. Role changes go through `/api/users`,
  which needs `user:update` — deliberately not through the employee form, or any HR manager could
  promote themselves to admin.

The interesting boundary: **`modules/identity` is framework-free, and `lib/auth.ts` is its
adapter.** JWT signing/verification and cookie reading live in `lib/` because they touch
`next/headers`. The module itself never imports Next.

`PasswordHasherPort` + `BcryptHasher` — Adapter. The login use case depends on the interface, so
its tests hash nothing and run instantly.

`toActor()` converts a JWT payload into the plain `Actor` object the domain understands. `Actor` is
deliberately **not** a session, a JWT, or a database row — it is a literal you can type in a test.
Since 0010 it carries ONE id: `employeeId`, never null. Being authenticated means being an employee,
so row-level scoping no longer has a "signed in but not a person" case to defend against.

## `modules/people` (Dev B)

Employees, departments, job positions.

Owns `EmployeeLookupPort` (consumed by payroll and time-off) and `EmployeeStatsPort` (consumed by
the dashboard). Three Postgres repositories, all extending `BaseSqlRepository`.

Patterns: **Repository** per aggregate; **Controller** as the thin seam between HTTP and use cases;
**Aggregate Root** on `Employee`.

Note `findEligible({ departmentId, employeeType, activeOn })` on the lookup port — payroll calls
this to build a run's employee list, and `activeOn` is a *date*, not "now", so re-running a past
period selects who was active *then*.

**Something to fix before demo:** the docstring on
`modules/people/interface/employee.controller.ts` still says "it connects to Mongo". Stale from the
MongoDB era. The code is correct; the comment is not. Worth deleting so nobody is caught out by it.

## `modules/employment` (Dev B)

Contracts and working schedules. Small module, but it owns **the single most consequential rule in
the system.**

**`domain/contract-resolution.ts` — a pure Domain Service.** No I/O, no framework. Payroll asks
"which contract applies to this payroll period for this employee" and gets a contract or `null`.
The rules:

1. Only contracts whose validity range overlaps the payroll period are candidates.
2. Among candidates, prefer the one covering the period's **end** date.
3. Tie-break on the latest `start`.
4. No overlapping contract at all → `null`, which is a **legitimate answer, not an error** —
   payroll turns it into a warning.

Why this is the important one: it is what makes **re-running last quarter produce last quarter's
figures instead of today's.** If payroll used "the employee's current contract", then anyone who
got a raise would have their entire salary history silently rewritten. Because the rule lives in
one pure function behind `ContractQueryPort`, it exists in exactly one place and is exhaustively
unit-tested.

`contractsOverlap()` is reused for write-time overlap *prevention*, so the same definition of
"overlap" governs both reading and writing. Backed at the database level by an `EXCLUDE USING gist`
constraint — the invariant holds even against a direct SQL insert.

Open-ended contracts (`end === null`) are handled as `Number.POSITIVE_INFINITY` rather than with a
null branch at every comparison.

## `modules/attendance` (Dev B)

Check-in/check-out, corrections, worked-hours derivation.

**`Attendance` — Aggregate Root.** Private constructor; `checkIn()` for new records,
`reconstitute()` for rebuilding from persisted data (trusted — validation already happened once).
Every mutation returns a **new instance**, never mutating in place.

**Worked hours are never stored.** They are always derived from `checkIn`/`checkOut`/`breakMinutes`
through the domain service, so the stored value and the computed value cannot drift apart.

**`domain/worked-hours.service.ts`** — pure, and it is where three genuinely tricky cases are
handled explicitly. These are exactly the questions an evaluator pokes at:

- **Missing check-out** → returns an explicit `Err(MISSING_CHECKOUT)`. It does **not** return 0,
  because 0 hours looks identical to an absence and would silently reduce someone's pay.
- **Shift crossing midnight** → if check-out is numerically before check-in (23:00 → 06:00), a day
  is added rather than producing a negative duration.
- **Break longer than the shift** → rejected as a data-entry error, not clamped and not turned into
  negative hours.

`correct()` always flips `manual` to true, whatever else changes — the audit flag cannot be
forgotten, because it is not optional.

`CheckInUseCase` guards against a second open record (`ALREADY_CHECKED_IN` → 409) and uses
`authorizeOwned(actor, 'attendance', 'create', employeeId)` so an employee can check themselves in
and nobody else.

## `modules/timeoff` (Dev A)

Leave types, allocations, requests, approvals, balances.

**`domain/leave-request-state.ts` — the State pattern**, one object per state:

```
draft --submit--> to_approve --approve--> approved
                             --refuse---> refused
                               approved --refuse--> refused  (with balance restore)
```

Why a class per state rather than a switch: **an illegal transition becomes impossible to express**,
rather than merely discouraged. `RefusedState.approve()` does not exist as a valid path — it throws.
Adding a `cancelled` state later means adding one object, not auditing every `if (status === …)` in
the codebase. The states are stateless singletons — they describe transitions, they do not hold
request data — so allocating them costs nothing.

`consumesBalance` is a property *of the state*, which means "has this consumed entitlement" is
answered by the state machine rather than re-derived at each call site.

**`domain/balance.service.ts`** — pure balance maths. Two decisions worth explaining:

- **Allocation selection prefers the one expiring soonest.** Consuming a balance about to lapse
  before one that runs another year is what a human would do; the other order silently destroys
  entitlement.
- **`pending` is separate from `taken`.** Submitted-but-unapproved requests have *not* consumed the
  allocation, but an employee deciding whether to book more leave needs to see them.
  `remaining = allocated − taken − pending`, because that answers the question actually being
  asked: "how much more may I book."

**`UnitOfWorkPort` — Unit of Work.** Approving leave does two writes: consume the allocation, and
move the request to approved. If the first lands and the second does not, the employee has lost
days they never took and nothing will ever notice. Both writes go through one connection in one
transaction. The application layer never learns what a `PoolClient` is — it asks for "repositories
that share a transaction, run my work, commit or roll back as a unit". A fake unit of work that
just calls the callback with in-memory repos makes the use case testable with no database at all.

## `modules/payroll-config` (Dev C)

Salary structures and salary rules — the configuration half of payroll.

**`domain/computation/` — Strategy + Registry.** A rule says *what* it is (name, code, category,
sequence); a `ComputationConfig` says *how* its amount is derived. Three strategies: `fixed`,
`percentage`, `formula`. Adding a fourth is **one class plus one line in `strategy.registry.ts`** —
the engine, the aggregates and the persistence layer are untouched. That is Open/Closed with
something concrete to point at.

The three types are exactly what `salary_rules.computation_type` allows in migration 0003, and each
one's parameters are exactly what that table's CHECK constraint requires. **The database and the
domain agree by construction, not by convention.**

**`domain/rule-engine.ts`.** Rules run in `sequence` order; each may reference results of rules that
ran *before* it, by code. Three properties make it correct:

1. Referencing a code that has not run yet **raises** — never silently zero. A payslip that is
   wrong but looks right is the worst available outcome.
2. Every amount is `Money` end to end, so no paise is invented or lost between BASIC and NET.
3. Contract wage and worked-days ratio arrive as **reserved inputs** (`WAGE`, `WORKED_RATIO`,
   `WORKED_DAYS`) rather than as rules — so a structure reads the period's contract **without the
   engine ever knowing what a contract is.**

Two subtleties that show real thought:

- **Scalars are kept separate from amounts.** A 22/30 proration ratio is 0.7333…; storing it as
  `Money` would round it to 0.73 and quietly **underpay every prorated payslip by about 0.5%**.
  `WORKED_RATIO` is deliberately a plain number, and asking for it as an amount produces a
  *specific* error message telling you to use it in a formula instead.
- **The ratio is clamped to [0, 1].** Attendance is real-world data; a missing check-out or a
  correction can produce more worked time than the schedule expects. Paying 103% of a wage because
  of a data-entry artefact is not a payroll behaviour anyone wants — overtime is an explicit rule
  instead.

Proration is expressed as the seeded rule `BASIC = WAGE * WORKED_RATIO`, which makes it **visible
in the configuration** rather than hidden behind a boolean flag.

Duplicate rule codes within a structure throw rather than letting the second silently shadow the
first.

## `modules/payroll-processing` (Dev C)

Payruns and payslips — the execution half.

**`domain/payrun-state.ts` — State Machine as a transition table:**

```
draft ──compute──▶ computed ──validate──▶ validated ──pay──▶ paid
                      ↑    │
                      └────┘ recompute
draft / computed ──cancel──▶ cancelled   (terminal)
```

Once validated, a run is history — the spec requires finalised runs preserved and read-only, so
there is deliberately **no edge backwards**. `markPaid()` on a draft throws in the aggregate, not in
a controller that might forget. Recomputing a `computed` run *is* allowed, because a corrected rule
must be able to regenerate figures before anyone signs off. The five states are exactly
`payruns_status_valid` in migration 0009.

**`domain/eligibility.spec.ts` — Specification pattern.** One pure predicate answering "may this
employee be in this payrun", returning a verdict with a *reason* and a display-ready message. Why it
matters: **the wizard's employee list and the create-payrun use case ask the same question.** If
each had its own idea of "eligible", a user could select someone in step 2 and be rejected on
submit — the kind of inconsistency that destroys trust in a payroll system fast. It re-checks period
coverage as defence in depth even though `ContractQueryPort` should already have handled it, because
a payslip computed from a non-covering contract is wrong in a way nobody notices until an audit.

**`domain/warnings/` — Strategy + Registry again, different axis.** Four pre-finalisation checks
(missing contract, duplicate payslip, missing bank details, contract expiring), each its own class
implementing `IPayrollWarningCheck`, collected in an array. Adding a fifth is one import and one
array entry; neither the validate use case nor the processing screen changes, because **both ask the
registry rather than knowing which checks exist.** `severity: 'error'` blocks validation;
`'warning'` does not.

**`domain/payslip-factory.ts` — Factory.** `(employee, contract, structure, period) → Payslip`.
Pure: it receives snapshots and returns an aggregate. **Which contract applies is decided by the
caller**, through the port — never guessed at here. If the schedule expects zero hours in the period
there is nothing to prorate against, so it pays in full rather than zero — dividing by an absent
denominator should not silently wipe out a salary.

**`ComputePayrunUseCase` — the orchestration crown jewel.** It depends on **seven ports** and zero
concrete classes. Details worth being able to defend:

- **Proration is measured in hours, not days.** A part-time employee's schedule expects fewer hours
  per day; dividing days by days would pay them a full-timer's wage for a full-timer's day count.
- **Expected hours are cached per schedule.** Twenty employees on one 40-hour schedule ask
  Employment once, not twenty times — the calculation is identical for all of them.
- **Employees without a resolvable contract are skipped, not paid zero**, and each becomes a
  blocking warning.
- **A broken structure fails the whole run loudly** rather than quietly producing partial payslips.

## `modules/analytics` (Dev A)

The payroll dashboard. Contains **no data of its own** — it is a pure consumer, composing five
ports.

`GetDashboardUseCase` fires **eleven port calls concurrently** in one `Promise.all`. Sequentially
that is eleven round trips to a database in Singapore before anything renders; concurrently it is
one. This is the module that most visibly proves the port architecture works: it computes KPIs,
charts, alerts, attendance overview and department breakdown **without importing a single feature
module.**

Two judgement calls to note: `averageSalary` is **recomputed** from totals rather than trusting the
port's own average, so the number always agrees with the totals displayed beside it; and attendance
coverage is measured against **days elapsed**, not the whole month, so a dashboard viewed on the 5th
does not report 84% absence.

## `modules/delivery` (Dev A)

**Not implemented.** Payslip PDF generation and bulk email. `PayslipQueryPort` is registered and
ready for it; the module is a stub. Say this plainly if asked — it is on the roadmap in the README,
and pretending otherwise is worse than the gap.

---

# PART 4 — DESIGN PATTERN INDEX

| Pattern | Where | Why *there* specifically |
|---|---|---|
| **Ports & Adapters** | `port-keys.ts`, `container.ts`, every `*.port.ts` | Three devs, one codebase. Consumers work against interfaces; providers register from their own module. Nobody blocks, integration is a bootstrap line. |
| **Dependency Injection / Composition Root** | `lib/bootstrap.ts`, `container.ts` | One place binds interfaces to implementations. Nothing else calls `new PostgresXRepository()`, so a test can bind differently. |
| **Null Object** | `portOr(key, fallback)` | The app renders correctly when half-integrated. Zeros, not crashes. |
| **Repository** | every `Postgres*Repository` | Application depends on `IRepository`. Storage swap touches one folder. Proven by the Mongo→Postgres move. |
| **Template Method** | `BaseSqlRepository` | The boring 80% of persistence (paging/filter/sort/CRUD) written once. Also the single place identifier-safety is enforced. |
| **Unit of Work** | `UnitOfWorkPort` + `postgres-unit-of-work.ts` | Leave approval writes twice. Partial success silently destroys entitlement. One transaction, and the app layer never sees a `PoolClient`. |
| **Value Object** | `Money`, `Period` | Money as float = unfindable reconciliation bugs. Period overlap defined once = contract selection and leave collision cannot disagree. |
| **Aggregate Root** | `Employee`, `Attendance`, `Payrun`, `LeaveRequest`, `Contract` | Invariants enforced at the only door in. Private constructors, static factories, new instance per mutation. |
| **Domain Service** | `contract-resolution`, `worked-hours.service`, `balance.service`, `weekly-hours.service` | Logic belonging to no single entity. Pure ⇒ exhaustively tested in milliseconds. |
| **Strategy + Registry** | `computation/`, `warnings/` | New computation type or new pre-finalisation check = one class + one line. Engine and callers never change. Open/Closed, demonstrable. |
| **State** | `leave-request-state.ts` (objects), `payrun-state.ts` (table) | Illegal transitions become inexpressible instead of merely discouraged. New state = new object, not an audit of every `if`. |
| **Specification** | `eligibility.spec.ts` | The wizard and the use case must ask one question. Divergence = selectable-then-rejected employees. |
| **Factory** | `payslip-factory.ts`, `Attendance.checkIn()`, `Money.of()` | Construction with invariants, separate from persistence. Pure ⇒ testable with literals. |
| **Result / Either** | `Result<T>`, `attempt()` | Expected failures visible in the type signature. Controllers with no try/catch pyramids, one HTTP error contract. |
| **Observer** | `InMemoryEventBus` | Side effects without coupling. A failing subscriber cannot break the publisher's transaction. |
| **Facade / Controller** | every `*.controller.ts` | Route handlers stay ~5 lines. Parse ends and a use case begins in exactly one identifiable place. |
| **Registry (permissions as data)** | `permissions.ts` | One auditable table. The **UI imports the same table**, so buttons and API cannot disagree. |
| **Adapter** | `lib/auth.ts`, `BcryptHasher`, every `*.adapter.ts` | Framework and library contact confined to the edge. `modules/identity` never imports Next. |

---

# PART 5 — WHAT TO SAY WHEN ASKED THE HARD ONES

**"Isn't this over-engineered for 24 hours?"**
The layering paid for itself once, visibly: the database changed from MongoDB to PostgreSQL
mid-project and only `infrastructure/` folders changed. Domain and application layers were
untouched. Also, the port architecture is *why* three people shipped ten modules in parallel — it is
not decoration on top of the schedule, it is the reason the schedule worked.

**"Show me SOLID."**

- **S** — one use case class, one operation. `CheckInUseCase` does check-in and nothing else.
- **O** — add a salary computation type: one class, one registry line. Engine unchanged.
- **L** — every `Postgres*Repository` is substitutable for its port; the in-memory test fakes prove
  it, because the same use case tests run against both.
- **I** — `EmployeeLookupPort` and `EmployeeStatsPort` are separate. Payroll needs lookup; the
  dashboard needs stats. Neither is forced to depend on the other's methods.
- **D** — `ComputePayrunUseCase` names seven interfaces and zero concrete classes.

**"How do you prevent SQL injection?"**
Values are always bind parameters. Identifiers cannot be, so the subclass's declared `columns` array
is an allowlist and every emitted identifier is checked against it and quoted. An unknown sort
column falls back to the default; an unknown filter is ignored rather than 500ing.

**"What happens when payroll is re-run for a past period?"**
`findApplicableContract(employeeId, period)` resolves the contract that covered *that period*,
preferring the one covering the period's end date. A raise granted since then does not rewrite
salary history.

## Known gaps — say these before you are asked

1. **No HTTP request has been served end to end.** 43 routes compile and 300 tests pass, but the app
   has not been exercised through a browser against the live database. **Do this before the demo.**
2. **`contracts` and `attendances` tables are empty.** Period-correct contract resolution and
   attendance-driven proration are unit-tested exhaustively but have never run against real rows.
   Seed both before demoing scenario A.
3. **`modules/delivery` is a stub** — no payslip PDF, no bulk email. On the roadmap.
4. **The stale "connects to Mongo" comment** in `employee.controller.ts`. Delete it.

Items 1 and 2 are the two that would actually break a live demo. Worth an hour before judging.
